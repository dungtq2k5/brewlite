import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiEnvelope,
  ApiErrors,
  Paged,
  RequirePermission,
  type WithMeta,
} from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { OrderResponseDto } from '../orders/dto/order.dto.js';
import { AdminOrdersService } from './admin-orders.service.js';
import {
  ADMIN_ORDER_META_PROPERTIES,
  AdminOrderDetailResponseDto,
  AdminOrderIdParamDto,
  ListAdminOrdersQueryDto,
  type AdminOrderMeta,
} from './dto/admin-order.dto.js';

@Controller('admin/orders')
@RequirePermission('order.read.all')
export class AdminOrdersController {
  constructor(private readonly adminOrders: AdminOrdersService) {}

  @Get()
  @ApiEnvelope(OrderResponseDto, { paged: true })
  @ApiErrors('VALIDATION_FAILED')
  list(
    @Query() query: ListAdminOrdersQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<Paged<OrderResponseDto>> {
    return this.adminOrders.list(ctx, query, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(AdminOrderDetailResponseDto, { meta: ADMIN_ORDER_META_PROPERTIES })
  @ApiErrors('RESOURCE_NOT_FOUND', 'VALIDATION_FAILED')
  get(
    @Param() params: AdminOrderIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<AdminOrderDetailResponseDto | WithMeta<AdminOrderDetailResponseDto, AdminOrderMeta>> {
    return this.adminOrders.get(ctx, params.id, req.id as string | undefined);
  }
}
