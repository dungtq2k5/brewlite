import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { AuthService } from './auth.service.js';
import * as passwordDomain from './domain/password.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import type { FirebaseAuthProvider } from '../../providers/auth/firebase.auth-provider.js';
import type { TokenService } from './token.service.js';

function errorCodeOf(exception: unknown): string | undefined {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function errorDetailsOf(exception: unknown): unknown {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const bin = metadata.get('bl-error-details-bin')[0] as Buffer | undefined;
  return bin === undefined ? undefined : JSON.parse(bin.toString('utf8'));
}

function p2002(index: string) {
  return { code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { index } } } } };
}

function fakePrisma() {
  const client = {
    user: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    session: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    ...client,
    // Runs the callback against the same mocks — no real transactional isolation needed
    // for these unit tests, only that the calls happen in order.
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? arg(client) : Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

function fakeTokens(): TokenService {
  return {
    signAccessToken: vi.fn(() => ({
      accessToken: 'a.b.c',
      accessTokenExpiresAt: new Date().toISOString(),
    })),
  } as unknown as TokenService;
}

describe('AuthService.login order', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let tokens: TokenService;
  let auth: AuthService;
  const verifyPasswordSpy = vi.spyOn(passwordDomain, 'verifyPassword');

  beforeEach(async () => {
    prisma = fakePrisma();
    tokens = fakeTokens();
    const users = {} as UsersService; // login() never touches UsersService — only register() does.
    const firebase = {} as FirebaseAuthProvider; // login() never touches Firebase.
    auth = new AuthService(prisma as unknown as PrismaService, tokens, users, firebase);
    await auth.onModuleInit();
    verifyPasswordSpy.mockClear();
  });

  it('an unknown email calls verifyPassword exactly once, against the dummy hash', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      auth.login({ email: 'nobody@brewlite.test', password: 'whatever' }),
    ).rejects.toThrow();

    expect(verifyPasswordSpy).toHaveBeenCalledTimes(1);
    const [, hashArg] = verifyPasswordSpy.mock.calls[0]!;
    expect(hashArg).not.toBe(undefined);
  });

  it('a wrong password on a locked account is INVALID_CREDENTIALS, never ACCOUNT_LOCKED', async () => {
    const userId = newId();
    prisma.user.findFirst.mockResolvedValue({
      id: userId,
      email: 'locked@brewlite.test',
      passwordHash: await passwordDomain.hashPassword('correct-password'),
      role: 'CUSTOMER',
      deletedAt: null,
    });

    const error = await auth
      .login({ email: 'locked@brewlite.test', password: 'wrong-password' })
      .catch((e: unknown) => e);

    expect(errorCodeOf(error)).toBe('INVALID_CREDENTIALS');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
}, 20_000);

describe('AuthService.signInWithFirebase', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let firebase: { verify: ReturnType<typeof vi.fn> };
  let auth: AuthService;

  function mockSuccessfulTail(role = 'CUSTOMER') {
    // completeSignIn's own reads/writes, once the account to sign in as is resolved.
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    prisma.user.findFirstOrThrow
      .mockResolvedValueOnce({ isLocked: false, lockedUntil: null, role })
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'x@example.com',
        fullName: 'X',
        role,
        passwordHash: null,
        preferredLocale: 'en',
        createdAt: new Date(),
      });
    prisma.user.update.mockResolvedValue({
      id: 'u1',
      role,
      deletedAt: null,
      firebaseUid: 'new-uid',
      passwordHash: null,
    });
    prisma.session.create.mockResolvedValue({ id: 's1' });
  }

  beforeEach(() => {
    prisma = fakePrisma();
    const tokens = fakeTokens();
    const users = {} as UsersService;
    firebase = { verify: vi.fn() };
    auth = new AuthService(
      prisma as unknown as PrismaService,
      tokens,
      users,
      firebase as unknown as FirebaseAuthProvider,
    );
  });

  it('a non-Google/Apple provider is refused with reason PROVIDER', async () => {
    firebase.verify.mockResolvedValue({
      uid: 'u',
      email: 'a@x.com',
      emailVerified: true,
      provider: 'password',
      name: null,
    });
    const error = await auth.signInWithFirebase({ idToken: 't' }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('FIREBASE_TOKEN_INVALID');
    expect(errorDetailsOf(error)).toEqual({ reason: 'PROVIDER' });
  });

  it('an unverified email is refused with reason EMAIL_UNVERIFIED', async () => {
    firebase.verify.mockResolvedValue({
      uid: 'u',
      email: 'a@x.com',
      emailVerified: false,
      provider: 'google.com',
      name: null,
    });
    const error = await auth.signInWithFirebase({ idToken: 't' }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('FIREBASE_TOKEN_INVALID');
    expect(errorDetailsOf(error)).toEqual({ reason: 'EMAIL_UNVERIFIED' });
  });

  it('linking clears the password and deletes every session', async () => {
    firebase.verify.mockResolvedValue({
      uid: 'new-uid',
      email: 'link@x.com',
      emailVerified: true,
      provider: 'google.com',
      name: 'Link Test',
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'link@x.com',
      firebaseUid: null,
      passwordHash: 'hash',
      role: 'CUSTOMER',
      deletedAt: null,
    });
    mockSuccessfulTail();

    await auth.signInWithFirebase({ idToken: 't' });

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { firebaseUid: 'new-uid', passwordHash: null },
    });
  });

  it('a first-sign-in race retries once and finds the winner', async () => {
    firebase.verify.mockResolvedValue({
      uid: 'racer-uid',
      email: 'race@x.com',
      emailVerified: true,
      provider: 'google.com',
      name: null,
    });
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'winner',
      email: 'race@x.com',
      firebaseUid: 'racer-uid',
      passwordHash: null,
      role: 'CUSTOMER',
      deletedAt: null,
    });
    prisma.user.create.mockRejectedValueOnce(p2002('users_firebase_uid_key'));
    mockSuccessfulTail();

    const response = await auth.signInWithFirebase({ idToken: 't' });

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(response.created).toBe(false);
  });
}, 20_000);
