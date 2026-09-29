import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, Auth } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { LoyaltyService } from './loyalty.service.js';
import { LoyaltyResponseDto } from './dto/loyalty-response.dto.js';

@Controller('loyalty')
@Auth('USER')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('me')
  @ApiEnvelope(LoyaltyResponseDto)
  getMyLoyalty(@Ctx() ctx: UserContext, @Req() req: Request): Promise<LoyaltyResponseDto> {
    return this.loyalty.getMyLoyalty(ctx, req.id as string | undefined);
  }
}
