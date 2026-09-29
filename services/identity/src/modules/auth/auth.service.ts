import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  FULL_NAME_MAX_LENGTH,
  Locale,
  newId,
  normalizeEmail,
  normalizeText,
  parseEnum,
  REFRESH_TOKEN_TTL_MS,
  Role,
} from '@brewlite/contracts';
import type { Me } from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import {
  generateToken,
  hashToken,
  isUniqueConstraintViolation,
  rpcError,
} from '@brewlite/nest-common';
import type {
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  SignInWithFirebaseRequest,
  SignInWithFirebaseResponse,
} from '@brewlite/contracts/generated/brewlite/identity/auth_service.js';
import type { User } from '../../../generated/prisma/client.js';
import {
  FirebaseAuthProvider,
  type VerifiedFirebaseToken,
} from '../../providers/auth/firebase.auth-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ME_SELECT, toProtoMe } from '../users/user.mapper.js';
import { UsersService } from '../users/users.service.js';
import { hashPassword, verifyPassword } from './domain/password.js';
import { TokenService } from './token.service.js';

interface CompletedSignIn {
  user: Me;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly firebase: FirebaseAuthProvider,
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
      if (isUniqueConstraintViolation(error, 'email')) throw rpcError('EMAIL_TAKEN');
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

    return this.completeSignIn(user);
  }

  /**
   * *Continue with Google* / *Continue with Apple* (ADR 0013). Finds the account by
   * Firebase uid, then by email — including a deactivated one, so its email never
   * becomes a second account (step 7 below refuses it exactly as login does). A
   * password account matching by email gets linked: its password is cleared and every
   * session deleted, since the verified Firebase identity now owns the account.
   */
  async signInWithFirebase(
    request: SignInWithFirebaseRequest,
  ): Promise<SignInWithFirebaseResponse> {
    const verified = await this.firebase.verify(request.idToken);
    if (verified.provider !== 'google.com' && verified.provider !== 'apple.com') {
      throw rpcError('FIREBASE_TOKEN_INVALID', { reason: 'PROVIDER' });
    }
    if (!verified.emailVerified) {
      throw rpcError('FIREBASE_TOKEN_INVALID', { reason: 'EMAIL_UNVERIFIED' });
    }

    // Two tabs signing in for the first time race the insert — the loser's create hits
    // the firebase_uid or email unique index; retried once, which then finds the winner.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let user: User;
      let created = false;
      try {
        const found = await this.prisma.user.findFirst({
          where: { OR: [{ firebaseUid: verified.uid }, { email: verified.email }] },
        });
        if (found === null) {
          user = await this.prisma.user.create({
            data: {
              id: newId(),
              email: verified.email,
              firebaseUid: verified.uid,
              fullName: this.firebaseFullName(verified),
              role: Role.CUSTOMER,
            },
          });
          created = true;
        } else if (found.firebaseUid === verified.uid) {
          user = found;
        } else {
          // Not yet linked, or linked to a different uid — Firebase normally gives one
          // uid per email, so the latter means the Firebase user was deleted and
          // recreated. Re-links either way: the verified email is the proof ADR 0013
          // accepts, and refusing would lock the person out of their own account.
          user = await this.prisma.$transaction(async (tx) => {
            await tx.session.deleteMany({ where: { userId: found.id } });
            return tx.user.update({
              where: { id: found.id },
              data: { firebaseUid: verified.uid, passwordHash: null },
            });
          });
        }
      } catch (error) {
        if (attempt === 0 && isUniqueConstraintViolation(error)) continue;
        throw error;
      }
      return { ...(await this.completeSignIn(user)), created };
    }
    throw new Error('unreachable: signInWithFirebase retry loop must return or throw');
  }

  private firebaseFullName(verified: VerifiedFirebaseToken): string {
    const raw = verified.name ?? verified.email.split('@')[0];
    return normalizeText(raw).slice(0, FULL_NAME_MAX_LENGTH);
  }

  /**
   * Login's tail, shared with `signInWithFirebase` so the two sign-in paths cannot
   * drift: lift an expired lock, refuse a locked or deactivated account, stamp
   * `last_login_at`, issue a session and an access token.
   */
  private async completeSignIn(user: {
    id: string;
    role: string;
    deletedAt: Date | null;
  }): Promise<CompletedSignIn> {
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
}
