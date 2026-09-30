import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { OrderResponseDto } from '../orders/dto/order.dto.js';
import { StaffOrdersService } from './staff-orders.service.js';
import {
  AdvanceStatusDto,
  CancelPaidDto,
  ListBoardQueryDto,
  StaffOrderIdParamDto,
} from './dto/staff-order.dto.js';

@Controller('staff/orders')
export class StaffOrdersController {
  constructor(private readonly staffOrders: StaffOrdersService) {}

  @Get()
  @RequirePermission('order.board.read')
  @ApiEnvelope(OrderResponseDto, { list: true })
  @ApiErrors('VALIDATION_FAILED')
  listBoard(
    @Query() query: ListBoardQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<OrderResponseDto[]> {
    return this.staffOrders.listBoard(query, ctx, req.id as string | undefined);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermission('order.status.update')
  @ApiEnvelope(OrderResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  advanceStatus(
    @Param() params: StaffOrderIdParamDto,
    @Body() dto: AdvanceStatusDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<OrderResponseDto> {
    return this.staffOrders.advanceStatus(params.id, dto, ctx, req.id as string | undefined);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('order.cancel.paid')
  @ApiEnvelope(OrderResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  cancelPaid(
    @Param() params: StaffOrderIdParamDto,
    @Body() dto: CancelPaidDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<OrderResponseDto> {
    return this.staffOrders.cancelPaid(params.id, dto, ctx, req.id as string | undefined);
  }
}
