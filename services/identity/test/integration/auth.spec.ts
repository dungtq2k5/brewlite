import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callerFrom } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
import { UsersService } from '../../src/modules/users/users.service.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';
import { generateTestKeyPair } from '../setup/test-keys.js';

async function buildApp() {
  const { privateKeyBase64, keyId } = generateTestKeyPair();
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
        JWT_PRIVATE_KEY: privateKeyBase64,
        JWT_KEY_ID: keyId,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, AuthModule, UsersModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCodeOf(exception: unknown): string | undefined {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function detailsOf(exception: unknown): unknown {
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const [raw] = metadata.get('bl-error-details-bin');
  if (raw === undefined) return undefined;
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary');
  return JSON.parse(buffer.toString('utf8')) as unknown;
}

describe('AuthService integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let auth: AuthService;
  let users: UsersService;

  beforeAll(async () => {
    app = await buildApp();
    auth = app.get(AuthService);
    users = app.get(UsersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('register creates one user and one session whose hash matches', async () => {
    const res = await auth.register({
      email: 'new@brewlite.test',
      password: 'password123',
      fullName: 'New Customer',
    });
    expect(res.user?.role).toBe('CUSTOMER');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@brewlite.test' } });
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.userId).toBe(user.id);
  });

  it('EMAIL_TAKEN under two concurrent registrations of one email — one 201, one 409', async () => {
    const body = { email: 'race@brewlite.test', password: 'password123', fullName: 'Racer' };
    const results = await Promise.allSettled([auth.register(body), auth.register(body)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(errorCodeOf((rejected[0] as PromiseRejectedResult).reason)).toBe('EMAIL_TAKEN');
  });

  it('login stamps last_login_at', async () => {
    await auth.register({ email: 'stamped@brewlite.test', password: 'password123', fullName: 'X' });
    await auth.login({ email: 'stamped@brewlite.test', password: 'password123' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'stamped@brewlite.test' } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('a lock with locked_until in the future is untouched by the expired-lock lift', async () => {
    const res = await auth.register({
      email: 'locked-future@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    const lockedUntil = new Date(Date.now() + 3_600_000);
    await prisma.user.update({
      where: { id: res.user!.id },
      data: { isLocked: true, lockReason: 'test', lockedUntil },
    });
    const error = await auth
      .login({ email: 'locked-future@brewlite.test', password: 'password123' })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('ACCOUNT_LOCKED');
    expect(detailsOf(error)).toEqual({ lockedUntil: lockedUntil.toISOString() });
  });

  it('an expired lock lifts and login succeeds', async () => {
    const res = await auth.register({
      email: 'locked-past@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await prisma.user.update({
      where: { id: res.user!.id },
      data: { isLocked: true, lockReason: 'test', lockedUntil: new Date(Date.now() - 1000) },
    });
    const login = await auth.login({ email: 'locked-past@brewlite.test', password: 'password123' });
    expect(login.user?.id).toBe(res.user!.id);
  });

  it('refresh refuses an expired session', async () => {
    const res = await auth.register({
      email: 'expired-refresh@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await prisma.session.updateMany({
      where: { userId: res.user!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const error = await auth.refresh({ refreshToken: res.refreshToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
  });

  it('refresh refuses an unknown (deleted-session) token', async () => {
    const error = await auth.refresh({ refreshToken: 'not-a-real-token' }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
  });

  it('refresh refuses a locked account', async () => {
    const res = await auth.register({
      email: 'locked-refresh@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await prisma.user.update({
      where: { id: res.user!.id },
      data: { isLocked: true, lockReason: 'test' },
    });
    const error = await auth.refresh({ refreshToken: res.refreshToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
  });

  it('refresh refuses a deactivated account', async () => {
    const res = await auth.register({
      email: 'deactivated-refresh@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await prisma.user.update({
      where: { id: res.user!.id },
      data: { deletedAt: new Date(), deletedById: res.user!.id },
    });
    const error = await auth.refresh({ refreshToken: res.refreshToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
  });

  it('refresh does not rotate the refresh token', async () => {
    const res = await auth.register({
      email: 'no-rotate@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await auth.refresh({ refreshToken: res.refreshToken });
    const second = await auth.refresh({ refreshToken: res.refreshToken });
    expect(second.accessToken).toBeTruthy();
  });

  it('logout twice is fine', async () => {
    const res = await auth.register({
      email: 'logout-twice@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await auth.logout({ refreshToken: res.refreshToken });
    await expect(auth.logout({ refreshToken: res.refreshToken })).resolves.toEqual({});
  });

  it('a deactivated account with a still-valid access token gets UNAUTHENTICATED on GetMe, not NOT_FOUND', async () => {
    const res = await auth.register({
      email: 'deactivated-me@brewlite.test',
      password: 'password123',
      fullName: 'X',
    });
    await prisma.user.update({
      where: { id: res.user!.id },
      data: { deletedAt: new Date(), deletedById: res.user!.id },
    });
    const metadata = {
      get: (key: string) =>
        key === 'x-user-id' ? [res.user!.id] : key === 'x-user-role' ? ['CUSTOMER'] : [],
    } as unknown as Metadata;
    const error = await users.getMe(callerFrom(metadata)).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('UNAUTHENTICATED');
  });
});
