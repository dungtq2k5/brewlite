import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
import { getEmulatorIdToken } from '../support/emulator-token.js';
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

describe('AuthService.signInWithFirebase integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let auth: AuthService;

  beforeAll(async () => {
    app = await buildApp();
    auth = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a Google sign-in creates a CUSTOMER, then signs the same person in again', async () => {
    const email = `google-${newId()}@example.com`;
    const idToken1 = await getEmulatorIdToken({
      provider: 'google.com',
      email,
      name: 'Google User',
    });
    const first = await auth.signInWithFirebase({ idToken: idToken1 });
    expect(first.created).toBe(true);
    expect(first.user?.role).toBe('CUSTOMER');
    expect(first.user?.hasPassword).toBe(false);
    expect(first.user?.fullName).toBe('Google User');

    const idToken2 = await getEmulatorIdToken({
      provider: 'google.com',
      email,
      name: 'Google User',
    });
    const second = await auth.signInWithFirebase({ idToken: idToken2 });
    expect(second.created).toBe(false);
    expect(second.user?.id).toBe(first.user?.id);
  });

  it('links a password account by email, clears the password, and deletes its sessions', async () => {
    const email = `link-${newId()}@example.com`;
    const registered = await auth.register({
      email,
      password: 'password123',
      fullName: 'Password User',
    });

    const idToken = await getEmulatorIdToken({
      provider: 'google.com',
      email,
      name: 'Password User',
    });
    const linked = await auth.signInWithFirebase({ idToken });
    expect(linked.user?.id).toBe(registered.user!.id);
    expect(linked.user?.hasPassword).toBe(false);

    const oldRefreshError = await auth
      .refresh({ refreshToken: registered.refreshToken })
      .catch((e: unknown) => e);
    expect(errorCodeOf(oldRefreshError)).toBe('UNAUTHENTICATED');

    const passwordLoginError = await auth
      .login({ email, password: 'password123' })
      .catch((e: unknown) => e);
    expect(errorCodeOf(passwordLoginError)).toBe('INVALID_CREDENTIALS');
  });

  it('a deactivated account found by email is refused, and no second row appears', async () => {
    const email = `deactivated-${newId()}@example.com`;
    const registered = await auth.register({ email, password: 'password123', fullName: 'X' });
    await prisma.user.update({
      where: { id: registered.user!.id },
      data: { deletedAt: new Date(), deletedById: registered.user!.id },
    });

    const idToken = await getEmulatorIdToken({ provider: 'google.com', email });
    const error = await auth.signInWithFirebase({ idToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('ACCOUNT_DEACTIVATED');

    const rows = await prisma.user.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
  });

  // The dev-token helper only signs google.com/apple.com identities — a password-provider
  // token comes from the emulator's own accounts:signUp endpoint instead.
  async function getEmulatorPasswordToken(email: string): Promise<string> {
    const host = testEnv.FIREBASE_AUTH_EMULATOR_HOST;
    const res = await fetch(
      `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123x', returnSecureToken: true }),
      },
    );
    const data = (await res.json()) as { idToken: string };
    return data.idToken;
  }

  it('refuses a password-provider token with reason PROVIDER', async () => {
    const email = `pw-provider-${newId()}@example.com`;
    const idToken = await getEmulatorPasswordToken(email);
    const error = await auth.signInWithFirebase({ idToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('FIREBASE_TOKEN_INVALID');
    expect(detailsOf(error)).toEqual({ reason: 'PROVIDER' });
  });

  it('refuses an unverified email with reason EMAIL_UNVERIFIED', async () => {
    const email = `unverified-${newId()}@example.com`;
    const idToken = await getEmulatorIdToken({
      provider: 'google.com',
      email,
      emailVerified: false,
    });
    const error = await auth.signInWithFirebase({ idToken }).catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('FIREBASE_TOKEN_INVALID');
    expect(detailsOf(error)).toEqual({ reason: 'EMAIL_UNVERIFIED' });
  });

  it('refuses garbage with reason INVALID', async () => {
    const error = await auth
      .signInWithFirebase({ idToken: 'not-a-real-token' })
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('FIREBASE_TOKEN_INVALID');
    expect(detailsOf(error)).toEqual({ reason: 'INVALID' });
  });
});
