import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@brewlite/contracts';
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
} from '@brewlite/contracts/generated/brewlite/identity/auth_service.js';
import type {
  GetMeRequest,
  GetMeResponse,
  UpdateMeRequest,
  UpdateMeResponse,
} from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import { AuthModule } from '../../src/modules/auth/auth.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { UsersModule } from '../../src/modules/users/users.module.js';
import { envSchema } from '../../src/config/env.schema.js';
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

@Module({ imports: [configModule, PrismaModule, AuthModule, UsersModule] })
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
  refresh(request: RefreshRequest): Promise<RefreshResponse> {
    return this.call('refresh', request);
  }
  logout(request: LogoutRequest): Promise<LogoutResponse> {
    return this.call('logout', request);
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
});
