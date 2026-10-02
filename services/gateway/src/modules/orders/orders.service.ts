import { Injectable } from '@nestjs/common';
import { Paged, type Caller, type CursorMeta } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { toOrderResponseDto, toQuoteResponseDto } from './order.mapper.js';
import { OrderingServiceGrpcClient } from './ordering-service-grpc.client.js';
import type {
  ListMyOrdersQueryDto,
  OrderResponseDto,
  PlaceOrderDto,
  QuoteDto,
  QuoteResponseDto,
} from './dto/order.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class OrdersService {
  constructor(private readonly ordering: OrderingServiceGrpcClient) {}

  async quote(dto: QuoteDto, ctx: UserContext, requestId?: string): Promise<QuoteResponseDto> {
    const response = await this.ordering.quote(
      toCaller(ctx),
      { items: dto.items, promoCode: dto.promoCode },
      requestId,
    );
    return toQuoteResponseDto(response);
  }

  async placeOrder(
    dto: PlaceOrderDto,
    idempotencyKey: string,
    ctx: UserContext,
    requestId?: string,
  ): Promise<{ order: OrderResponseDto; created: boolean }> {
    const response = await this.ordering.placeOrder(
      toCaller(ctx),
      { items: dto.items, promoCode: dto.promoCode, note: dto.note, idempotencyKey },
      requestId,
    );
    return { order: toOrderResponseDto(response.order!), created: response.created };
  }

  async listMyOrders(
    query: ListMyOrdersQueryDto,
    ctx: UserContext,
    requestId?: string,
  ): Promise<Paged<OrderResponseDto, CursorMeta>> {
    const response = await this.ordering.listMyOrders(
      toCaller(ctx),
      { cursor: query.cursor, limit: query.limit, status: query.status },
      requestId,
    );
    return Paged.cursor(response.orders.map(toOrderResponseDto), {
      nextCursor: response.nextCursor ?? null,
    });
  }

  async getOrder(id: string, ctx: UserContext, requestId?: string): Promise<OrderResponseDto> {
    const response = await this.ordering.getOrder(toCaller(ctx), { id }, requestId);
    return toOrderResponseDto(response.order!);
  }

  async cancelOrder(id: string, ctx: UserContext, requestId?: string): Promise<OrderResponseDto> {
    const response = await this.ordering.cancelOrder(toCaller(ctx), { id }, requestId);
    return toOrderResponseDto(response.order!);
  }
}
