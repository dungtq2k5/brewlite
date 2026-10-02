import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiEnvelope,
  ApiErrors,
  Auth,
  Paged,
  RateLimit,
  type CursorMeta,
} from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import {
  ApiIdempotencyKey,
  RequireIdempotencyKey,
} from '../../auth/require-idempotency-key.decorator.js';
import { OrdersService } from './orders.service.js';
import {
  ListMyOrdersQueryDto,
  OrderResponseDto,
  PlaceOrderDto,
  QuoteDto,
  QuoteResponseDto,
} from './dto/order.dto.js';
import { OrderIdParamDto } from './dto/order-id-param.dto.js';

@Controller('orders')
@Auth('USER')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quote')
  @RateLimit('ORDER_WRITE')
  @ApiEnvelope(QuoteResponseDto)
  @ApiErrors(
    'PRODUCT_UNAVAILABLE',
    'OPTION_INVALID',
    'OUT_OF_STOCK',
    'ORDER_TOTAL_TOO_LOW',
    'ORDER_TOTAL_TOO_HIGH',
  )
  quote(
    @Body() dto: QuoteDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<QuoteResponseDto> {
    return this.orders.quote(dto, ctx, req.id as string | undefined);
  }

  @Post()
  @ApiIdempotencyKey()
  @RateLimit('ORDER_WRITE')
  @ApiEnvelope(OrderResponseDto)
  @ApiErrors(
    'PRODUCT_UNAVAILABLE',
    'OPTION_INVALID',
    'OUT_OF_STOCK',
    'STOCK_CONTENDED',
    'ORDER_TOTAL_TOO_LOW',
    'ORDER_TOTAL_TOO_HIGH',
    'IDEMPOTENCY_KEY_REQUIRED',
    'IDEMPOTENCY_KEY_REUSED',
  )
  async placeOrder(
    @Body() dto: PlaceOrderDto,
    @RequireIdempotencyKey() idempotencyKey: string,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderResponseDto> {
    const { order, created } = await this.orders.placeOrder(
      dto,
      idempotencyKey,
      ctx,
      req.id as string | undefined,
    );
    res.status(created ? 201 : 200);
    return order;
  }

  @Get('me')
  @ApiEnvelope(OrderResponseDto, { cursor: true })
  @ApiErrors('VALIDATION_FAILED')
  listMyOrders(
    @Query() query: ListMyOrdersQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<Paged<OrderResponseDto, CursorMeta>> {
    return this.orders.listMyOrders(query, ctx, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(OrderResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  getOrder(
    @Param() params: OrderIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<OrderResponseDto> {
    return this.orders.getOrder(params.id, ctx, req.id as string | undefined);
  }

  @Post(':id/cancel')
  @RateLimit('ORDER_WRITE')
  @ApiEnvelope(OrderResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  cancelOrder(
    @Param() params: OrderIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<OrderResponseDto> {
    return this.orders.cancelOrder(params.id, ctx, req.id as string | undefined);
  }
}
