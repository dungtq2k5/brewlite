import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callerFrom } from '@brewlite/nest-common';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { AdminUsersModule } from '../../src/modules/admin-users/admin-users.module.js';
import { AdminUsersService } from '../../src/modules/admin-users/admin-users.service.js';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
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
    imports: [configModule, PrismaModule, AuthModule, UsersModule, AdminUsersModule],
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

function callerOf(userId: string, role = 'ADMIN'): ReturnType<typeof callerFrom> {
  const metadata = {
    get: (key: string) => (key === 'x-user-id' ? [userId] : key === 'x-user-role' ? [role] : []),
  } as unknown as Metadata;
  return callerFrom(metadata);
}

async function createAdmin(): Promise<string> {
  const res = await prisma.user.create({
    data: {
      id: newId(),
      email: `admin-${newId()}@brewlite.test`,
      fullName: 'Admin',
      role: 'ADMIN',
      passwordHash: '$'.repeat(60),
    },
  });
  return res.id;
}

async function createCustomer(): Promise<string> {
  const res = await prisma.user.create({
    data: {
      id: newId(),
      email: `customer-${newId()}@brewlite.test`,
      fullName: 'Customer',
      role: 'CUSTOMER',
      passwordHash: '$'.repeat(60),
    },
  });
  return res.id;
}

describe('AdminUsersService integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let adminUsers: AdminUsersService;
  let auth: AuthService;

  beforeAll(async () => {
    app = await buildApp();
    adminUsers = app.get(AdminUsersService);
    auth = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('each §4.3 refusal fires in order: existence, self, state, last-admin', async () => {
    const admin = await createAdmin();

    const notFound = await adminUsers
      .changeRole({ id: newId(), role: 'STAFF' }, callerOf(admin))
      .catch((e: unknown) => e);
    expect(errorCodeOf(notFound)).toBe('RESOURCE_NOT_FOUND');

    const self = await adminUsers
      .changeRole({ id: admin, role: 'STAFF' }, callerOf(admin))
      .catch((e: unknown) => e);
    expect(errorCodeOf(self)).toBe('SELF_ACTION_FORBIDDEN');

    const customer = await createCustomer();
    await adminUsers.deactivateUser({ id: customer }, callerOf(admin));
    const state = await adminUsers
      .changeRole({ id: customer, role: 'STAFF' }, callerOf(admin))
      .catch((e: unknown) => e);
    expect(errorCodeOf(state)).toBe('INVALID_STATE');
    expect(detailsOf(state)).toEqual({ status: 'DEACTIVATED' });

    const second = await createAdmin();
    await adminUsers.changeRole({ id: admin, role: 'STAFF' }, callerOf(second));
    const lastAdmin = await adminUsers
      .changeRole({ id: second, role: 'STAFF' }, callerOf(admin, 'STAFF'))
      .catch((e: unknown) => e);
    expect(errorCodeOf(lastAdmin)).toBe('LAST_ADMIN');
  });

  it('linking-free lock/unlock moves the three columns together, and re-locking replaces them', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const until = new Date(Date.now() + 3_600_000);

    const locked = await adminUsers.lockUser(
      { id: customer, reason: 'first', lockedUntil: until.toISOString() },
      callerOf(admin),
    );
    expect(locked.user).toMatchObject({ isLocked: true, lockReason: 'first' });

    const relocked = await adminUsers.lockUser({ id: customer, reason: 'second' }, callerOf(admin));
    expect(relocked.user).toMatchObject({ isLocked: true, lockReason: 'second' });
    expect(relocked.user?.lockedUntil).toBeUndefined();

    const unlocked = await adminUsers.unlockUser({ id: customer }, callerOf(admin));
    expect(unlocked.user).toMatchObject({ isLocked: false, lockReason: undefined });
  });

  it('lockedUntil bounds refuse a past date and one beyond MAX_LOCK_DURATION_DAYS', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();

    const tooSoon = await adminUsers
      .lockUser(
        { id: customer, reason: 'x', lockedUntil: new Date(Date.now() - 1000).toISOString() },
        callerOf(admin),
      )
      .catch((e: unknown) => e);
    expect(errorCodeOf(tooSoon)).toBe('VALIDATION_FAILED');

    const tooFar = await adminUsers
      .lockUser(
        {
          id: customer,
          reason: 'x',
          lockedUntil: new Date(Date.now() + 1000 * 3600 * 24 * 400).toISOString(),
        },
        callerOf(admin),
      )
      .catch((e: unknown) => e);
    expect(errorCodeOf(tooFar)).toBe('VALIDATION_FAILED');
  });

  it('the concurrent demotion test: two admins demote each other at the same moment', async () => {
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();

    const results = await Promise.allSettled([
      adminUsers.changeRole({ id: admin2, role: 'STAFF' }, callerOf(admin1)),
      adminUsers.changeRole({ id: admin1, role: 'STAFF' }, callerOf(admin2)),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(errorCodeOf((rejected[0] as PromiseRejectedResult).reason)).toBe('LAST_ADMIN');

    const remainingAdmins = await prisma.user.count({
      where: { id: { in: [admin1, admin2] }, role: 'ADMIN' },
    });
    expect(remainingAdmins).toBe(1);
  });

  it('list filters: deleted=true returns only deactivated rows, sort + id tie-break, total', async () => {
    const admin = await createAdmin();
    const a = await createCustomer();
    const b = await createCustomer();
    await adminUsers.deactivateUser({ id: a }, callerOf(admin));

    const deactivatedOnly = await adminUsers.listUsers({
      deleted: true,
      page: { page: 1, pageSize: 50, sort: '-createdAt' },
    });
    expect(deactivatedOnly.users.every((u) => u.deletedAt !== undefined)).toBe(true);
    expect(deactivatedOnly.users.some((u) => u.id === a)).toBe(true);
    expect(deactivatedOnly.users.some((u) => u.id === b)).toBe(false);

    const page = await adminUsers.listUsers({ page: { page: 1, pageSize: 1, sort: 'email' } });
    expect(page.meta?.total).toBeGreaterThan(1);
    expect(page.users).toHaveLength(1);
  });

  it('deactivate deletes every session and refuses a repeat with INVALID_STATE; restore keeps a lock', async () => {
    const admin = await createAdmin();
    const registered = await auth.register({
      email: `deact-${newId()}@brewlite.test`,
      password: 'password123',
      fullName: 'X',
    });
    await adminUsers.lockUser({ id: registered.user!.id, reason: 'kept' }, callerOf(admin));

    await adminUsers.deactivateUser({ id: registered.user!.id }, callerOf(admin));
    const sessionCount = await prisma.session.count({ where: { userId: registered.user!.id } });
    expect(sessionCount).toBe(0);

    const repeat = await adminUsers
      .deactivateUser({ id: registered.user!.id }, callerOf(admin))
      .catch((e: unknown) => e);
    expect(errorCodeOf(repeat)).toBe('INVALID_STATE');
    expect(detailsOf(repeat)).toEqual({ status: 'DEACTIVATED' });

    const restored = await adminUsers.restoreUser({ id: registered.user!.id }, callerOf(admin));
    expect(restored.user?.deletedAt).toBeUndefined();
    expect(restored.user?.isLocked).toBe(true);
    expect(restored.user?.lockReason).toBe('kept');

    const restoreLiveAgain = await adminUsers
      .restoreUser({ id: registered.user!.id }, callerOf(admin))
      .catch((e: unknown) => e);
    expect(errorCodeOf(restoreLiveAgain)).toBe('INVALID_STATE');
    expect(detailsOf(restoreLiveAgain)).toEqual({ status: 'ACTIVE' });
  });
});
