import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiEnvelope,
  ApiErrors,
  Paged,
  RequirePermission,
  SkipEnvelope,
} from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUserResponseDto } from './dto/admin-user-response.dto.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { LockUserDto } from './dto/lock-user.dto.js';
import { UserIdParamDto } from './dto/user-id-param.dto.js';

@Controller('admin/users')
@RequirePermission('user.manage')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiEnvelope(AdminUserResponseDto, { paged: true })
  @ApiErrors('VALIDATION_FAILED')
  list(
    @Query() query: ListUsersQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<Paged<AdminUserResponseDto>> {
    return this.adminUsers.listUsers(ctx, query, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(AdminUserResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  get(
    @Param() params: UserIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsers.getUser(ctx, params.id, req.id as string | undefined);
  }

  @Patch(':id/role')
  @ApiEnvelope(AdminUserResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'SELF_ACTION_FORBIDDEN', 'INVALID_STATE', 'LAST_ADMIN')
  changeRole(
    @Param() params: UserIdParamDto,
    @Body() dto: ChangeRoleDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsers.changeRole(ctx, params.id, dto, req.id as string | undefined);
  }

  @Post(':id/lock')
  @ApiEnvelope(AdminUserResponseDto)
  @ApiErrors(
    'RESOURCE_NOT_FOUND',
    'SELF_ACTION_FORBIDDEN',
    'INVALID_STATE',
    'LAST_ADMIN',
    'VALIDATION_FAILED',
  )
  lock(
    @Param() params: UserIdParamDto,
    @Body() dto: LockUserDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsers.lockUser(ctx, params.id, dto, req.id as string | undefined);
  }

  @Post(':id/unlock')
  @ApiEnvelope(AdminUserResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  unlock(
    @Param() params: UserIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsers.unlockUser(ctx, params.id, req.id as string | undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('RESOURCE_NOT_FOUND', 'SELF_ACTION_FORBIDDEN', 'INVALID_STATE', 'LAST_ADMIN')
  async deactivate(
    @Param() params: UserIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.adminUsers.deactivateUser(ctx, params.id, req.id as string | undefined);
  }

  @Post(':id/restore')
  @ApiEnvelope(AdminUserResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  restore(
    @Param() params: UserIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminUserResponseDto> {
    return this.adminUsers.restoreUser(ctx, params.id, req.id as string | undefined);
  }
}
