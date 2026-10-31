import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { LoyaltyResponseDto } from '../loyalty/dto/loyalty-response.dto.js';
import { AdminUserActivityService } from './admin-user-activity.service.js';
import { UserIdParamDto } from '../admin-users/dto/user-id-param.dto.js';
import { StaffStatsQueryDto, StaffStatsResponseDto } from './dto/staff-stats.dto.js';

/** Served by ordering, shown on the admin's user page — hence `admin/users/:id/…` (api §9.1). */
@Controller('admin/users/:id')
export class AdminUserActivityController {
  constructor(private readonly activity: AdminUserActivityService) {}

  @Get('loyalty')
  @RequirePermission('user.manage')
  @ApiEnvelope(LoyaltyResponseDto)
  @ApiErrors('VALIDATION_FAILED')
  loyalty(
    @Param() params: UserIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<LoyaltyResponseDto> {
    return this.activity.loyaltyOf(ctx, params.id, req.id as string | undefined);
  }

  @Get('staff-stats')
  @RequirePermission('report.read')
  @ApiEnvelope(StaffStatsResponseDto)
  @ApiErrors('VALIDATION_FAILED')
  staffStats(
    @Param() params: UserIdParamDto,
    @Query() query: StaffStatsQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<StaffStatsResponseDto> {
    return this.activity.staffStats(ctx, params.id, query, req.id as string | undefined);
  }
}
