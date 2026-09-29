import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  newId,
  normalizeEmail,
  zText,
  type Locale,
  type Role,
} from '@brewlite/contracts';
import { live, requireUser, rpcError, type Caller } from '@brewlite/nest-common';
import type {
  GetMeResponse,
  Me,
  UpdateMeRequest,
  UpdateMeResponse,
} from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from '../auth/domain/password.js';
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
