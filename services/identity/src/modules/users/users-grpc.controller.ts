import { Controller, UseInterceptors } from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { callerFrom, GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  UserServiceControllerMethods,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  type GetMeRequest,
  type GetMeResponse,
  type UpdateMeRequest,
  type UpdateMeResponse,
  type UserServiceController,
} from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import { UsersService } from './users.service.js';

@Controller()
@UserServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class UsersGrpcController implements UserServiceController {
  constructor(private readonly users: UsersService) {}

  getMe(_request: GetMeRequest, metadata?: Metadata): Promise<GetMeResponse> {
    return this.users.getMe(callerFrom(metadata));
  }

  updateMe(request: UpdateMeRequest, metadata?: Metadata): Promise<UpdateMeResponse> {
    return this.users.updateMe(callerFrom(metadata), request);
  }

  changePassword(
    request: ChangePasswordRequest,
    metadata?: Metadata,
  ): Promise<ChangePasswordResponse> {
    return this.users.changePassword(callerFrom(metadata), request);
  }
}
