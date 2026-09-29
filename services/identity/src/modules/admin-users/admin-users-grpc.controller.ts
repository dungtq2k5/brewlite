import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  AdminUserServiceControllerMethods,
  type AdminUserServiceController,
  type ChangeRoleRequest,
  type ChangeRoleResponse,
  type DeactivateUserRequest,
  type DeactivateUserResponse,
  type GetUserRequest,
  type GetUserResponse,
  type ListUsersRequest,
  type ListUsersResponse,
  type LockUserRequest,
  type LockUserResponse,
  type RestoreUserRequest,
  type RestoreUserResponse,
  type UnlockUserRequest,
  type UnlockUserResponse,
} from '@brewlite/contracts/generated/brewlite/identity/admin_user_service.js';
import { AdminUsersService } from './admin-users.service.js';

@Controller()
@AdminUserServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class AdminUsersGrpcController implements AdminUserServiceController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
    return this.adminUsers.listUsers(request);
  }

  getUser(request: GetUserRequest): Promise<GetUserResponse> {
    return this.adminUsers.getUser(request);
  }

  changeRole(request: ChangeRoleRequest, metadata?: Metadata): Promise<ChangeRoleResponse> {
    return this.adminUsers.changeRole(request, callerFrom(metadata));
  }

  lockUser(request: LockUserRequest, metadata?: Metadata): Promise<LockUserResponse> {
    return this.adminUsers.lockUser(request, callerFrom(metadata));
  }

  unlockUser(request: UnlockUserRequest, metadata?: Metadata): Promise<UnlockUserResponse> {
    return this.adminUsers.unlockUser(request, callerFrom(metadata));
  }

  deactivateUser(
    request: DeactivateUserRequest,
    metadata?: Metadata,
  ): Promise<DeactivateUserResponse> {
    return this.adminUsers.deactivateUser(request, callerFrom(metadata));
  }

  restoreUser(request: RestoreUserRequest, metadata?: Metadata): Promise<RestoreUserResponse> {
    return this.adminUsers.restoreUser(request, callerFrom(metadata));
  }
}
