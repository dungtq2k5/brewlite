import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { IDENTITY_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import {
  BaseGrpcClient,
  isGrpcServiceError,
  PROTO_LOADER_OPTIONS,
  readErrorCode,
  readErrorDetails,
  type Caller,
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
import type {
  GetMeRequest,
  GetMeResponse,
  UpdateMeRequest,
  UpdateMeResponse,
} from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import type {
  ChangeRoleRequest,
  ChangeRoleResponse,
  DeactivateUserRequest,
  DeactivateUserResponse,
  GetUserRequest,
  GetUserResponse,
  ListUsersRequest,
  ListUsersResponse,
  LockUserRequest,
  LockUserResponse,
  RestoreUserRequest,
  RestoreUserResponse,
  UnlockUserRequest,
  UnlockUserResponse,
} from '@brewlite/contracts/generated/brewlite/identity/admin_user_service.js';
import { AdminUsersModule } from '../../src/modules/admin-users/admin-users.module.js';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
import { envSchema } from '../../src/config/env.schema.js';
import { getEmulatorIdToken } from '../support/emulator-token.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';
import { generateTestKeyPair } from '../setup/test-keys.js';

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

@Module({ imports: [configModule, PrismaModule, AuthModule, UsersModule, AdminUsersModule] })
class RealIdentityModule {}

class TestIdentityClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.AuthService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  register(request: RegisterRequest): Promise<RegisterResponse> {
    return this.call('register', request);
  }
  login(request: LoginRequest): Promise<LoginResponse> {
    return this.call('login', request);
  }
  signInWithFirebase(request: SignInWithFirebaseRequest): Promise<SignInWithFirebaseResponse> {
    return this.call('signInWithFirebase', request);
  }
  refresh(request: RefreshRequest): Promise<RefreshResponse> {
    return this.call('refresh', request);
  }
  logout(request: LogoutRequest): Promise<LogoutResponse> {
    return this.call('logout', request);
  }
}

class TestAdminUsersClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.AdminUserService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  listUsers(request: ListUsersRequest, opts: { caller: Caller }): Promise<ListUsersResponse> {
    return this.call('listUsers', request, opts);
  }
  getUser(request: GetUserRequest, opts: { caller: Caller }): Promise<GetUserResponse> {
    return this.call('getUser', request, opts);
  }
  changeRole(request: ChangeRoleRequest, opts: { caller: Caller }): Promise<ChangeRoleResponse> {
    return this.call('changeRole', request, opts);
  }
  lockUser(request: LockUserRequest, opts: { caller: Caller }): Promise<LockUserResponse> {
    return this.call('lockUser', request, opts);
  }
  unlockUser(request: UnlockUserRequest, opts: { caller: Caller }): Promise<UnlockUserResponse> {
    return this.call('unlockUser', request, opts);
  }
  deactivateUser(
    request: DeactivateUserRequest,
    opts: { caller: Caller },
  ): Promise<DeactivateUserResponse> {
    return this.call('deactivateUser', request, opts);
  }
  restoreUser(request: RestoreUserRequest, opts: { caller: Caller }): Promise<RestoreUserResponse> {
    return this.call('restoreUser', request, opts);
  }
}

class TestUsersClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.UserService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  getMe(request: GetMeRequest, opts: { caller: Caller }): Promise<GetMeResponse> {
    return this.call('getMe', request, opts);
  }
  updateMe(request: UpdateMeRequest, opts: { caller: Caller }): Promise<UpdateMeResponse> {
    return this.call('updateMe', request, opts);
  }
}

describe('identity gRPC contract', () => {
  const url = 'localhost:25097';
  let app: Awaited<ReturnType<typeof NestFactory.createMicroservice>>;
  let authClient: TestIdentityClient;
  let usersClient: TestUsersClient;
  let adminUsersClient: TestAdminUsersClient;

  beforeAll(async () => {
    app = await NestFactory.createMicroservice<MicroserviceOptions>(RealIdentityModule, {
      transport: Transport.GRPC,
      options: {
        package: 'brewlite.identity',
        protoPath: IDENTITY_PROTO_FILES,
        url,
        loader: { ...PROTO_LOADER_OPTIONS, includeDirs: [PROTO_ROOT] },
      },
    });
    await app.listen();
    authClient = new TestIdentityClient(url);
    usersClient = new TestUsersClient(url);
    adminUsersClient = new TestAdminUsersClient(url);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes a real Register round trip', async () => {
    const res = await authClient.register({
      email: 'contract-register@brewlite.test',
      password: 'password123',
      fullName: 'Contract Register',
    });
    expect(res.user?.role).toBe('CUSTOMER');
    expect(res.accessToken).toBeTruthy();
  });

  it('completes a real Login round trip', async () => {
    await authClient.register({
      email: 'contract-login@brewlite.test',
      password: 'password123',
      fullName: 'Contract Login',
    });
    const res = await authClient.login({
      email: 'contract-login@brewlite.test',
      password: 'password123',
    });
    expect(res.user?.email).toBe('contract-login@brewlite.test');
  });

  it('completes a real Refresh round trip', async () => {
    const registered = await authClient.register({
      email: 'contract-refresh@brewlite.test',
      password: 'password123',
      fullName: 'Contract Refresh',
    });
    const res = await authClient.refresh({ refreshToken: registered.refreshToken });
    expect(res.accessToken).toBeTruthy();
  });

  it('completes a real Logout round trip', async () => {
    const registered = await authClient.register({
      email: 'contract-logout@brewlite.test',
      password: 'password123',
      fullName: 'Contract Logout',
    });
    await expect(authClient.logout({ refreshToken: registered.refreshToken })).resolves.toEqual({});
  });

  it('completes a real GetMe round trip, with the caller forwarded as metadata', async () => {
    const registered = await authClient.register({
      email: 'contract-getme@brewlite.test',
      password: 'password123',
      fullName: 'Contract GetMe',
    });
    const res = await usersClient.getMe(
      {},
      { caller: { kind: 'USER', userId: registered.user!.id, role: Role.CUSTOMER } },
    );
    expect(res.me?.id).toBe(registered.user!.id);
  });

  it('completes a real UpdateMe round trip', async () => {
    const registered = await authClient.register({
      email: 'contract-updateme@brewlite.test',
      password: 'password123',
      fullName: 'Contract UpdateMe',
    });
    const res = await usersClient.updateMe(
      { fullName: 'Updated Name' },
      { caller: { kind: 'USER', userId: registered.user!.id, role: Role.CUSTOMER } },
    );
    expect(res.me?.fullName).toBe('Updated Name');
  });

  it("ACCOUNT_LOCKED's lockedUntil arrives intact through bl-error-details-bin", async () => {
    const registered = await authClient.register({
      email: 'contract-locked@brewlite.test',
      password: 'password123',
      fullName: 'Contract Locked',
    });
    const lockedUntil = new Date(Date.now() + 3_600_000);
    await prisma.user.update({
      where: { id: registered.user!.id },
      data: { isLocked: true, lockReason: 'contract test', lockedUntil },
    });

    await expect(
      authClient.login({ email: 'contract-locked@brewlite.test', password: 'password123' }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('ACCOUNT_LOCKED');
      expect(readErrorDetails(error)).toEqual({ lockedUntil: lockedUntil.toISOString() });
      return true;
    });
  });

  it('completes a real SignInWithFirebase round trip', async () => {
    const email = 'contract-firebase@brewlite.test';
    const idToken = await getEmulatorIdToken({
      provider: 'google.com',
      email,
      name: 'Contract FB',
    });
    const res = await authClient.signInWithFirebase({ idToken });
    expect(res.user?.email).toBe(email);
    expect(res.created).toBe(true);
  });

  async function adminCaller(): Promise<Extract<Caller, { kind: 'USER' }>> {
    const admin = await prisma.user.create({
      data: {
        id: newId(),
        email: `contract-admin-${newId()}@brewlite.test`,
        fullName: 'Contract Admin',
        role: Role.ADMIN,
        passwordHash: '$'.repeat(60),
      },
    });
    return { kind: 'USER', userId: admin.id, role: Role.ADMIN };
  }

  it('completes real ListUsers and GetUser round trips', async () => {
    const caller = await adminCaller();
    const listed = await adminUsersClient.listUsers(
      { page: { page: 1, pageSize: 5, sort: '-createdAt' } },
      { caller },
    );
    expect(listed.meta?.total).toBeGreaterThan(0);

    const got = await adminUsersClient.getUser({ id: caller.userId }, { caller });
    expect(got.user?.id).toBe(caller.userId);
  });

  it('completes real ChangeRole, LockUser and UnlockUser round trips', async () => {
    const caller = await adminCaller();
    const target = await prisma.user.create({
      data: {
        id: newId(),
        email: `contract-target-${newId()}@brewlite.test`,
        fullName: 'Contract Target',
        role: Role.CUSTOMER,
        passwordHash: '$'.repeat(60),
      },
    });

    const changed = await adminUsersClient.changeRole(
      { id: target.id, role: Role.STAFF },
      { caller },
    );
    expect(changed.user?.role).toBe(Role.STAFF);

    const locked = await adminUsersClient.lockUser(
      { id: target.id, reason: 'contract' },
      { caller },
    );
    expect(locked.user?.isLocked).toBe(true);

    const unlocked = await adminUsersClient.unlockUser({ id: target.id }, { caller });
    expect(unlocked.user?.isLocked).toBe(false);
  });

  it('completes real DeactivateUser and RestoreUser round trips', async () => {
    const caller = await adminCaller();
    const target = await prisma.user.create({
      data: {
        id: newId(),
        email: `contract-deactivate-${newId()}@brewlite.test`,
        fullName: 'Contract Deactivate',
        role: Role.CUSTOMER,
        passwordHash: '$'.repeat(60),
      },
    });

    const deactivated = await adminUsersClient.deactivateUser({ id: target.id }, { caller });
    expect(deactivated.user?.deletedAt).toBeTruthy();

    const restored = await adminUsersClient.restoreUser({ id: target.id }, { caller });
    expect(restored.user?.deletedAt).toBeUndefined();
  });

  it('LAST_ADMIN and INVALID_STATE.status cross the boundary intact', async () => {
    const solo = await prisma.user.create({
      data: {
        id: newId(),
        email: `contract-solo-admin-${newId()}@brewlite.test`,
        fullName: 'Solo Admin',
        role: Role.ADMIN,
        passwordHash: '$'.repeat(60),
      },
    });
    const soloCaller: Caller = { kind: 'USER', userId: solo.id, role: Role.ADMIN };
    const other = await prisma.user.create({
      data: {
        id: newId(),
        email: `contract-other-admin-${newId()}@brewlite.test`,
        fullName: 'Other Admin',
        role: Role.ADMIN,
        passwordHash: '$'.repeat(60),
      },
    });
    const otherCaller: Caller = { kind: 'USER', userId: other.id, role: Role.ADMIN };
    await adminUsersClient.changeRole({ id: other.id, role: Role.STAFF }, { caller: soloCaller });

    await expect(
      adminUsersClient.changeRole({ id: solo.id, role: Role.STAFF }, { caller: otherCaller }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('LAST_ADMIN');
      return true;
    });

    await adminUsersClient.deactivateUser({ id: other.id }, { caller: soloCaller });
    await expect(
      adminUsersClient.changeRole({ id: other.id, role: Role.STAFF }, { caller: soloCaller }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isGrpcServiceError(error)).toBe(true);
      if (!isGrpcServiceError(error)) return false;
      expect(readErrorCode(error)).toBe('INVALID_STATE');
      expect(readErrorDetails(error)).toEqual({ status: 'DEACTIVATED' });
      return true;
    });
  });
});
