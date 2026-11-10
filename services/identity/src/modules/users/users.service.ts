import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  newId,
  normalizeEmail,
  zPassword,
  zText,
  type Locale,
  type Role,
} from '@brewlite/contracts';
import { live, requireUser, rpcError, type Caller } from '@brewlite/nest-common';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  GetMeResponse,
  Me,
  UpdateMeRequest,
  UpdateMeResponse,
} from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../auth/domain/password.js';
import { ME_SELECT, toProtoMe, type MeRow } from './user.mapper.js';

const zFullName = zText(100);

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(caller: Caller): Promise<GetMeResponse> {
    return { me: await this.findMe(caller) };
  }

  /**
   * The one place a password-holding account is created — register, the seed and
   * `bootstrap:admin` all go through this, so the hash is always real. Takes a
   * transaction client so a caller (register) can create the session in the same
   * transaction; defaults to the plain client for callers that don't need one.
   */
  async createWithPassword(
    params: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
      preferredLocale?: Locale;
    },
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<MeRow> {
    return tx.user.create({
      data: {
        id: newId(),
        email: normalizeEmail(params.email),
        passwordHash: await hashPassword(params.password),
        fullName: zFullName.parse(params.fullName),
        role: params.role,
        preferredLocale: params.preferredLocale ?? DEFAULT_LOCALE,
      },
      select: ME_SELECT,
    });
  }

  async updateMe(caller: Caller, request: UpdateMeRequest): Promise<UpdateMeResponse> {
    const { userId } = requireUser(caller);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(request.fullName !== undefined && { fullName: zFullName.parse(request.fullName) }),
        ...(request.preferredLocale !== undefined && {
          preferredLocale: request.preferredLocale,
        }),
      },
    });
    return { me: await this.findMe(caller) };
  }

  /**
   * api §1.2 `PATCH /users/me/password`. An account with a password must prove it
   * (`CURRENT_PASSWORD_INCORRECT`); a Google-only account (no hash) sets its first one and
   * `currentPassword` is ignored. The new hash and the end of every *other* session commit
   * together — the caller's own session (`sessionId`, the token's `sid`) stays signed in.
   */
  async changePassword(
    caller: Caller,
    request: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    const { userId } = requireUser(caller);
    for (const [path, value] of [
      ['/newPassword', request.newPassword],
      ...(request.currentPassword !== undefined
        ? ([['/currentPassword', request.currentPassword]] as const)
        : []),
    ] as const) {
      if (!zPassword.safeParse(value).success) {
        throw rpcError('VALIDATION_FAILED', { issues: [{ path, code: 'custom' }] });
      }
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...live },
      select: { passwordHash: true },
    });
    if (!user) throw rpcError('UNAUTHENTICATED');
    if (user.passwordHash !== null) {
      const current = request.currentPassword;
      if (current === undefined || !(await verifyPassword(current, user.passwordHash))) {
        throw rpcError('CURRENT_PASSWORD_INCORRECT');
      }
    }

    const passwordHash = await hashPassword(request.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { userId, id: { not: request.sessionId } } }),
    ]);
    return {};
  }

  private async findMe(caller: Caller): Promise<Me> {
    const { userId } = requireUser(caller);
    // A deactivated account with a still-valid access token gets UNAUTHENTICATED, not
    // NOT_FOUND — the account is gone for them, and 401 clears the web server's cookies.
    const row = await this.prisma.user.findFirst({
      where: { id: userId, ...live },
      select: ME_SELECT,
    });
    if (!row) throw rpcError('UNAUTHENTICATED');
    return toProtoMe(row);
  }
}
