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
  signInWithFirebase(
    request: SignInWithFirebaseRequest,
    requestId?: string,
  ): Promise<SignInWithFirebaseResponse> {
    return this.call('signInWithFirebase', request, { requestId });
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

class AdminUserGrpcClient extends BaseGrpcClient {
  constructor(url: string) {
    super({
      serviceName: 'brewlite.identity.AdminUserService',
      protoFiles: IDENTITY_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url,
    });
  }

  listUsers(
    request: ListUsersRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<ListUsersResponse> {
    return this.call('listUsers', request, opts);
  }
  getUser(
    request: GetUserRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<GetUserResponse> {
    return this.call('getUser', request, opts);
  }
  changeRole(
    request: ChangeRoleRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<ChangeRoleResponse> {
    return this.call('changeRole', request, opts);
  }
  lockUser(
    request: LockUserRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<LockUserResponse> {
    return this.call('lockUser', request, opts);
  }
  unlockUser(
    request: UnlockUserRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<UnlockUserResponse> {
    return this.call('unlockUser', request, opts);
  }
  deactivateUser(
    request: DeactivateUserRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<DeactivateUserResponse> {
    return this.call('deactivateUser', request, opts);
  }
  restoreUser(
    request: RestoreUserRequest,
    opts: { requestId?: string; caller: Caller },
  ): Promise<RestoreUserResponse> {
    return this.call('restoreUser', request, opts);
  }
}

/** One peer, one client class — `AuthService`, `UserService` and `AdminUserService` share the identity gRPC endpoint. */
@Injectable()
export class IdentityServiceGrpcClient {
  private readonly auth: AuthGrpcClient;
  private readonly users: UserGrpcClient;
  private readonly adminUsers: AdminUserGrpcClient;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('IDENTITY_GRPC_URL', { infer: true });
    this.auth = new AuthGrpcClient(url);
    this.users = new UserGrpcClient(url);
    this.adminUsers = new AdminUserGrpcClient(url);
  }

  register(request: RegisterRequest, requestId?: string): Promise<RegisterResponse> {
    return this.auth.register(request, requestId);
  }
  login(request: LoginRequest, requestId?: string): Promise<LoginResponse> {
    return this.auth.login(request, requestId);
  }
  signInWithFirebase(
    request: SignInWithFirebaseRequest,
    requestId?: string,
  ): Promise<SignInWithFirebaseResponse> {
    return this.auth.signInWithFirebase(request, requestId);
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
  listUsers(
    caller: Caller,
    request: ListUsersRequest,
    requestId?: string,
  ): Promise<ListUsersResponse> {
    return this.adminUsers.listUsers(request, { requestId, caller });
  }
  getUser(caller: Caller, request: GetUserRequest, requestId?: string): Promise<GetUserResponse> {
    return this.adminUsers.getUser(request, { requestId, caller });
  }
  changeRole(
    caller: Caller,
    request: ChangeRoleRequest,
    requestId?: string,
  ): Promise<ChangeRoleResponse> {
    return this.adminUsers.changeRole(request, { requestId, caller });
  }
  lockUser(
    caller: Caller,
    request: LockUserRequest,
    requestId?: string,
  ): Promise<LockUserResponse> {
    return this.adminUsers.lockUser(request, { requestId, caller });
  }
  unlockUser(
    caller: Caller,
    request: UnlockUserRequest,
    requestId?: string,
  ): Promise<UnlockUserResponse> {
    return this.adminUsers.unlockUser(request, { requestId, caller });
  }
  deactivateUser(
    caller: Caller,
    request: DeactivateUserRequest,
    requestId?: string,
  ): Promise<DeactivateUserResponse> {
    return this.adminUsers.deactivateUser(request, { requestId, caller });
  }
  restoreUser(
    caller: Caller,
    request: RestoreUserRequest,
    requestId?: string,
  ): Promise<RestoreUserResponse> {
    return this.adminUsers.restoreUser(request, { requestId, caller });
  }
}
