import { Injectable } from '@nestjs/common';
import { Paged, type Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { IdentityServiceGrpcClient } from '../auth/identity-service-grpc.client.js';
import { toAdminUserResponseDto } from './admin-user.mapper.js';
import type { AdminUserResponseDto } from './dto/admin-user-response.dto.js';
import type { ChangeRoleDto } from './dto/change-role.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { LockUserDto } from './dto/lock-user.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly identity: IdentityServiceGrpcClient) {}

  async listUsers(
    ctx: UserContext,
    query: ListUsersQueryDto,
    requestId?: string,
  ): Promise<Paged<AdminUserResponseDto>> {
    const response = await this.identity.listUsers(
      toCaller(ctx),
      {
        page: { page: query.page, pageSize: query.pageSize, sort: query.sort },
        q: query.q,
        role: query.role,
        locked: query.locked,
        deleted: query.deleted,
      },
      requestId,
    );
    return Paged.page(response.users.map(toAdminUserResponseDto), response.meta!);
  }

  async getUser(ctx: UserContext, id: string, requestId?: string): Promise<AdminUserResponseDto> {
    const response = await this.identity.getUser(toCaller(ctx), { id }, requestId);
    return toAdminUserResponseDto(response.user!);
  }

  async changeRole(
    ctx: UserContext,
    id: string,
    dto: ChangeRoleDto,
    requestId?: string,
  ): Promise<AdminUserResponseDto> {
    const response = await this.identity.changeRole(
      toCaller(ctx),
      { id, role: dto.role },
      requestId,
    );
    return toAdminUserResponseDto(response.user!);
  }

  async lockUser(
    ctx: UserContext,
    id: string,
    dto: LockUserDto,
    requestId?: string,
  ): Promise<AdminUserResponseDto> {
    const response = await this.identity.lockUser(
      toCaller(ctx),
      { id, reason: dto.reason, lockedUntil: dto.lockedUntil },
      requestId,
    );
    return toAdminUserResponseDto(response.user!);
  }

  async unlockUser(
    ctx: UserContext,
    id: string,
    requestId?: string,
  ): Promise<AdminUserResponseDto> {
    const response = await this.identity.unlockUser(toCaller(ctx), { id }, requestId);
    return toAdminUserResponseDto(response.user!);
  }

  async deactivateUser(ctx: UserContext, id: string, requestId?: string): Promise<void> {
    await this.identity.deactivateUser(toCaller(ctx), { id }, requestId);
  }

  async restoreUser(
    ctx: UserContext,
    id: string,
    requestId?: string,
  ): Promise<AdminUserResponseDto> {
    const response = await this.identity.restoreUser(toCaller(ctx), { id }, requestId);
    return toAdminUserResponseDto(response.user!);
  }
}
