import { Injectable, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Paged, WithMeta, type Caller } from '@brewlite/nest-common';
import type { Payment } from '@brewlite/contracts/generated/brewlite/payment/payment_service.js';
import type { UserContext } from '../../auth/request-context.js';
import { toOrderResponseDto } from '../orders/order.mapper.js';
import type { OrderResponseDto } from '../orders/dto/order.dto.js';
import { toPaymentResponseDto } from '../payments/payment.mapper.js';
import { PaymentServiceGrpcClient } from '../payments/payment-service-grpc.client.js';
import { AdminOrderGrpcClient } from './admin-order-grpc.client.js';
import type {
  AdminOrderDetailResponseDto,
  AdminOrderMeta,
  ListAdminOrdersQueryDto,
} from './dto/admin-order.dto.js';

const toCaller = (ctx: UserContext): Caller => ({
  kind: 'USER',
  userId: ctx.userId,
  role: ctx.role,
});

/** Payment being down or slow is the only failure the order page survives (api §3.4, §9.1). */
function isPaymentDown(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === GrpcStatus.UNAVAILABLE || code === GrpcStatus.DEADLINE_EXCEEDED;
}

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly orders: AdminOrderGrpcClient,
    private readonly payments: PaymentServiceGrpcClient,
  ) {}

  async list(
    ctx: UserContext,
    query: ListAdminOrdersQueryDto,
    requestId?: string,
  ): Promise<Paged<OrderResponseDto>> {
    const response = await this.orders.listOrders(
      toCaller(ctx),
      {
        page: { page: query.page, pageSize: query.pageSize, sort: query.sort },
        status: query.status,
        from: query.from,
        to: query.to,
        orderNo: query.orderNo === undefined ? undefined : String(query.orderNo),
      },
      requestId,
    );
    return Paged.page(response.orders.map(toOrderResponseDto), response.meta!);
  }

  /**
   * The order first (a missing one is `404`), then its payments. If payment is down the order
   * still shows: `payments: null` and `meta.degraded: ['payment']`. Any other payment error is
   * a real error.
   */
  async get(
    ctx: UserContext,
    id: string,
    requestId?: string,
  ): Promise<AdminOrderDetailResponseDto | WithMeta<AdminOrderDetailResponseDto, AdminOrderMeta>> {
    const caller = toCaller(ctx);
    const { order } = await this.orders.getAdminOrder(caller, { id }, requestId);
    const base = toOrderResponseDto(order!);

    let payments: Payment[];
    try {
      payments = (await this.payments.listPaymentsForOrder(caller, { orderId: id }, requestId))
        .payments;
    } catch (error) {
      if (!isPaymentDown(error)) throw error;
      this.logger.warn({ orderId: id, requestId }, 'payment unreachable; serving the order alone');
      return WithMeta.of({ ...base, payments: null }, { degraded: ['payment'] });
    }
    return { ...base, payments: payments.map(toPaymentResponseDto) };
  }
}
