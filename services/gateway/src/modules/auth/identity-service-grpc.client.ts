import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { IDENTITY_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
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
import type { Env } from '../../config/env.schema.js';

class AuthGrpcClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.AuthService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  register(request: RegisterRequest, requestId?: string): Promise<RegisterResponse> {
    return this.call('register', request, { requestId });
  }
  login(request: LoginRequest, requestId?: string): Promise<LoginResponse> {
    return this.call('login', request, { requestId });
  }
  refresh(request: RefreshRequest, requestId?: string): Promise<RefreshResponse> {
    return this.call('refresh', request, { requestId });
  }
  logout(request: LogoutRequest, requestId?: string): Promise<LogoutResponse> {
    return this.call('logout', request, { requestId });
  }
}

class UserGrpcClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.UserService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  getMe(
    request: GetMeRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<GetMeResponse> {
    return this.call('getMe', request, opts);
  }
  updateMe(
    request: UpdateMeRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<UpdateMeResponse> {
    return this.call('updateMe', request, opts);
  }
}

/** One peer, one client class — `AuthService` and `UserService` share the identity gRPC endpoint. */
@Injectable()
export class IdentityServiceGrpcClient {
  private readonly auth: AuthGrpcClient;
  private readonly users: UserGrpcClient;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('IDENTITY_GRPC_URL', { infer: true });
    this.auth = new AuthGrpcClient(url);
    this.users = new UserGrpcClient(url);
  }

  register(request: RegisterRequest, requestId?: string): Promise<RegisterResponse> {
    return this.auth.register(request, requestId);
  }
  login(request: LoginRequest, requestId?: string): Promise<LoginResponse> {
    return this.auth.login(request, requestId);
  }
  refresh(request: RefreshRequest, requestId?: string): Promise<RefreshResponse> {
    return this.auth.refresh(request, requestId);
  }
  logout(request: LogoutRequest, requestId?: string): Promise<LogoutResponse> {
    return this.auth.logout(request, requestId);
  }
  getMe(caller: Caller, requestId?: string): Promise<GetMeResponse> {
    return this.users.getMe({}, { requestId, caller });
  }
  updateMe(
    caller: Caller,
    request: UpdateMeRequest,
    requestId?: string,
  ): Promise<UpdateMeResponse> {
    return this.users.updateMe(request, { requestId, caller });
  }
}
