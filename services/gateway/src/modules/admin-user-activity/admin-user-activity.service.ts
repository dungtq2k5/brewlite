import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { LoyaltyGrpcClient } from '../loyalty/loyalty-grpc.client.js';
import { toLoyaltyResponseDto } from '../loyalty/loyalty.mapper.js';
import type { LoyaltyResponseDto } from '../loyalty/dto/loyalty-response.dto.js';
import { ReportGrpcClient } from '../admin-reports/report-grpc.client.js';
import type { StaffStatsQueryDto, StaffStatsResponseDto } from './dto/staff-stats.dto.js';

const toCaller = (ctx: UserContext): Caller => ({
  kind: 'USER',
  userId: ctx.userId,
  role: ctx.role,
});

/**
 * What the admin's user page shows about a customer or staff member that ordering knows. The
 * gateway does not ask identity whether the user exists: the admin page has just read them.
 */
@Injectable()
export class AdminUserActivityService {
  constructor(
    private readonly loyalty: LoyaltyGrpcClient,
    private readonly reports: ReportGrpcClient,
  ) {}

  async loyaltyOf(
    ctx: UserContext,
    userId: string,
    requestId?: string,
  ): Promise<LoyaltyResponseDto> {
    return toLoyaltyResponseDto(
      await this.loyalty.getLoyaltyForUser(toCaller(ctx), { userId }, requestId),
    );
  }

  async staffStats(
    ctx: UserContext,
    userId: string,
    query: StaffStatsQueryDto,
    requestId?: string,
  ): Promise<StaffStatsResponseDto> {
    const r = await this.reports.getStaffStats(
      toCaller(ctx),
      { userId, from: query.from, to: query.to },
      requestId,
    );
    return {
      from: r.from,
      to: r.to,
      ordersHandled: r.ordersHandled,
      transitions: {
        PREPARING: r.transitions?.preparing ?? 0,
        READY: r.transitions?.ready ?? 0,
        COMPLETED: r.transitions?.completed ?? 0,
        CANCELLED: r.transitions?.cancelled ?? 0,
      },
    };
  }
}
