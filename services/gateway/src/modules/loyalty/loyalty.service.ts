import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { LoyaltyGrpcClient } from './loyalty-grpc.client.js';
import { toLoyaltyResponseDto } from './loyalty.mapper.js';
import type { LoyaltyResponseDto } from './dto/loyalty-response.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly loyalty: LoyaltyGrpcClient) {}

  async getMyLoyalty(ctx: UserContext, requestId?: string): Promise<LoyaltyResponseDto> {
    const response = await this.loyalty.getMyLoyalty(toCaller(ctx), {}, requestId);
    return toLoyaltyResponseDto(response);
  }
}
