import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { AuthService } from './auth.service.js';
import * as passwordDomain from './domain/password.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';
import type { TokenService } from './token.service.js';

function errorCodeOf(exception: unknown): string | undefined {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function fakePrisma() {
  return {
    user: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    session: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
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
    auth = new AuthService(prisma as unknown as PrismaService, tokens, users);
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
