import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
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

/** The access token's `sid` — the session the request comes from. */
const sidOf = (token: string): string =>
  (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as { sid: string })
    .sid;

describe('UsersService.changePassword — real DB', () => {
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

  /** An account signed in three times: three sessions; the first is "this one". */
  async function threeSessions(email = `pw-${newId()}@brewlite.test`) {
    const registered = await auth.register({
      email,
      password: 'old-password',
      fullName: 'Lan Anh',
    });
    await auth.login({ email, password: 'old-password' });
    await auth.login({ email, password: 'old-password' });
    const userId = registered.user!.id;
    const caller: Caller = { kind: 'USER', userId, role: Role.CUSTOMER };
    return { email, userId, caller, sessionId: sidOf(registered.accessToken) };
  }

  it('the right current password: the new one works, every other session is gone, this one stays', async () => {
    const { email, userId, caller, sessionId } = await threeSessions();
    expect(await prisma.session.count({ where: { userId } })).toBe(3);

    await users.changePassword(caller, {
      sessionId,
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    const left = await prisma.session.findMany({ where: { userId }, select: { id: true } });
    expect(left).toEqual([{ id: sessionId }]);
    await expect(auth.login({ email, password: 'new-password' })).resolves.toBeDefined();
    const old = await auth.login({ email, password: 'old-password' }).catch((e: unknown) => e);
    expect(errorCodeOf(old)).toBe('INVALID_CREDENTIALS');
  });

  it('signsInWithGoogle follows the Firebase link: false for a password account, true for a Google one', async () => {
    const { caller } = await threeSessions();
    expect((await users.getMe(caller)).me).toMatchObject({
      hasPassword: true,
      signsInWithGoogle: false,
    });

    const userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        email: `only-google-${userId}@brewlite.test`,
        fullName: 'Only Google',
        role: Role.CUSTOMER,
        firebaseUid: `only-google-${userId}`,
      },
    });
    const google: Caller = { kind: 'USER', userId, role: Role.CUSTOMER };
    expect((await users.getMe(google)).me).toMatchObject({
      hasPassword: false,
      signsInWithGoogle: true,
    });
  });

  it('a wrong or missing current password is CURRENT_PASSWORD_INCORRECT, and nothing changes', async () => {
    const { userId, caller, sessionId } = await threeSessions();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    for (const currentPassword of ['wrong-password', undefined]) {
      const error = await users
        .changePassword(caller, { sessionId, currentPassword, newPassword: 'new-password' })
        .catch((e: unknown) => e);
      expect(errorCodeOf(error)).toBe('CURRENT_PASSWORD_INCORRECT');
    }
    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(await prisma.session.count({ where: { userId } })).toBe(3);
  });

  it('a Google-only account sets its first password without a current one, and has one afterwards', async () => {
    const userId = newId();
    const email = `google-${userId}@brewlite.test`;
    await prisma.user.create({
      data: {
        id: userId,
        email,
        fullName: 'Google User',
        role: Role.CUSTOMER,
        passwordHash: null,
        firebaseUid: `google-${userId}`,
      },
    });
    const caller: Caller = { kind: 'USER', userId, role: Role.CUSTOMER };

    await users.changePassword(caller, { sessionId: newId(), newPassword: 'first-password' });

    // Both ways in now: the Firebase link stays, and the password is new.
    expect((await users.getMe(caller)).me).toMatchObject({
      hasPassword: true,
      signsInWithGoogle: true,
    });
    await expect(auth.login({ email, password: 'first-password' })).resolves.toBeDefined();
  });

  it('refuses a new password under 8 or over 72 bytes (a Vietnamese passphrase counts bytes)', async () => {
    const { caller, sessionId } = await threeSessions();
    const longVi = 'Mỗi sáng tôi uống một ly cà phê sữa đá thật đậm ở góc phố cũ Hà Nội'; // 67 chars, 95 bytes
    expect(longVi.length).toBeLessThan(73);
    expect(Buffer.byteLength(longVi)).toBeGreaterThan(72);
    for (const newPassword of ['7 bytes', longVi]) {
      const error = await users
        .changePassword(caller, { sessionId, currentPassword: 'old-password', newPassword })
        .catch((e: unknown) => e);
      expect(errorCodeOf(error)).toBe('VALIDATION_FAILED');
    }
  });
});
