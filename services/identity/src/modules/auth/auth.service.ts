import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  Locale,
  newId,
  normalizeEmail,
  parseEnum,
  REFRESH_TOKEN_TTL_MS,
  Role,
} from '@brewlite/contracts';
import { generateToken, hashToken, rpcError } from '@brewlite/nest-common';
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from '@brewlite/contracts/generated/brewlite/identity/auth_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ME_SELECT, toProtoMe } from '../users/user.mapper.js';
import { UsersService } from '../users/users.service.js';
import { hashPassword, verifyPassword } from './domain/password.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  /** A cost-12 hash of a random string, computed once — so an unknown email still costs one bcrypt compare (conventions §9.1). */
  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword(generateToken());
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    const token = generateToken();
    const sessionExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    let user, sessionId: string;
    try {
      [user, { id: sessionId }] = await this.prisma.$transaction(async (tx) => {
        const createdUser = await this.users.createWithPassword(
          {
            email: request.email,
            password: request.password,
            fullName: request.fullName,
            role: Role.CUSTOMER,
            preferredLocale:
              request.preferredLocale !== undefined
                ? parseEnum(Locale, request.preferredLocale)
                : undefined,
          },
          tx,
        );
        const session = await tx.session.create({
          data: {
            id: newId(),
            userId: createdUser.id,
            refreshTokenHash: hashToken(token),
            expiresAt: sessionExpiresAt,
          },
        });
        return [createdUser, session] as const;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw rpcError('EMAIL_TAKEN');
      throw error;
    }

    const refreshToken = { token, sessionId };
    const refreshTokenExpiresAt = sessionExpiresAt.toISOString();
    const { accessToken, accessTokenExpiresAt } = this.tokens.signAccessToken(
      user.id,
      user.role,
      refreshToken.sessionId,
    );
    return {
      user: toProtoMe(user),
      accessToken,
      accessTokenExpiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
    };
  }

  /**
   * In exactly this order (doc's spec edit S1): the password is checked before an
   * expired lock is lifted or a lock/deactivation is revealed — otherwise anyone typing
   * an email would learn the account exists and is locked.
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const email = normalizeEmail(request.email);
    const user = await this.prisma.user.findFirst({ where: { email } });

    const ok = await verifyPassword(request.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !user.passwordHash || !ok) throw rpcError('INVALID_CREDENTIALS');

    const unlocked = await this.liftExpiredLock(user.id);
    if (unlocked.isLocked) throw rpcError('ACCOUNT_LOCKED', { lockedUntil: unlocked.lockedUntil });
    if (user.deletedAt !== null) throw rpcError('ACCOUNT_DEACTIVATED');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const me = await this.prisma.user.findFirstOrThrow({
      where: { id: user.id },
      select: ME_SELECT,
    });

    const { refreshToken, refreshTokenExpiresAt } = await this.createSession(user.id);
    const { accessToken, accessTokenExpiresAt } = this.tokens.signAccessToken(
      user.id,
      user.role,
      refreshToken.sessionId,
    );
    return {
      user: toProtoMe(me),
      accessToken,
      accessTokenExpiresAt,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
    };
  }

  async refresh(request: RefreshRequest): Promise<RefreshResponse> {
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hashToken(request.refreshToken), expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session || session.user.deletedAt !== null) throw rpcError('UNAUTHENTICATED');

    const unlocked = await this.liftExpiredLock(session.user.id);
    if (unlocked.isLocked) throw rpcError('UNAUTHENTICATED');

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    const { accessToken, accessTokenExpiresAt } = this.tokens.signAccessToken(
      session.user.id,
      unlocked.role,
      session.id,
    );
    return { accessToken, accessTokenExpiresAt };
  }

  async logout(request: LogoutRequest): Promise<LogoutResponse> {
    await this.prisma.session.deleteMany({
      where: { refreshTokenHash: hashToken(request.refreshToken) },
    });
    return {};
  }

  /** Sign-in and refresh run this before judging the account (rdm-spec §2.9) — idempotent, so two racing requests are harmless. */
  private async liftExpiredLock(
    userId: string,
  ): Promise<{ isLocked: boolean; lockedUntil: string | null; role: string }> {
    await this.prisma.user.updateMany({
      where: { id: userId, isLocked: true, lockedUntil: { lte: new Date() } },
      data: { isLocked: false, lockedUntil: null, lockReason: null },
    });
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId },
      select: { isLocked: true, lockedUntil: true, role: true },
    });
    return {
      isLocked: user.isLocked,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      role: user.role,
    };
  }

  private async createSession(userId: string): Promise<{
    refreshToken: { token: string; sessionId: string };
    refreshTokenExpiresAt: string;
  }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await this.prisma.session.create({
      data: { id: newId(), userId, refreshTokenHash: hashToken(token), expiresAt },
    });
    return {
      refreshToken: { token, sessionId: session.id },
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
    );
  }
}
