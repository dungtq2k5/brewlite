import { Injectable, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Paged, WithMeta, type Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { toOrderResponseDto } from '../orders/order.mapper.js';
import type { OrderResponseDto } from '../orders/dto/order.dto.js';
import { toPaymentResponseDto } from '../payments/payment.mapper.js';
import { IdentityServiceGrpcClient } from '../auth/identity-service-grpc.client.js';
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

/** A dependency being down or slow is the only failure the order page survives (api §3.4, §9.1). */
function isDown(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === GrpcStatus.UNAVAILABLE || code === GrpcStatus.DEADLINE_EXCEEDED;
}

const isNotFound = (error: unknown) =>
  (error as { code?: unknown } | null)?.code === GrpcStatus.NOT_FOUND;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };
const settle = <T>(promise: Promise<T>): Promise<Settled<T>> =>
  promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly orders: AdminOrderGrpcClient,
    private readonly payments: PaymentServiceGrpcClient,
    private readonly identity: IdentityServiceGrpcClient,
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
        userId: query.userId,
      },
      requestId,
    );
    return Paged.page(response.orders.map(toOrderResponseDto), response.meta!);
  }

  /**
   * The order first (a missing one is `404`), then — in parallel — its payments and the names of
   * the users behind its history. If payment or identity is down the order still shows
   * (`payments: null` / every `actorName: null`) and `meta.degraded` says which. Any other error
   * from either is a real error.
   */
  async get(
    ctx: UserContext,
    id: string,
    requestId?: string,
  ): Promise<AdminOrderDetailResponseDto | WithMeta<AdminOrderDetailResponseDto, AdminOrderMeta>> {
    const caller = toCaller(ctx);
    const { order } = await this.orders.getAdminOrder(caller, { id }, requestId);
    const base = toOrderResponseDto(order!);

    const [payments, names] = await Promise.all([
      settle(this.payments.listPaymentsForOrder(caller, { orderId: id }, requestId)),
      settle(this.namesOf(caller, order!.history, requestId)),
    ]);

    const degraded: AdminOrderMeta['degraded'] = [];
    if (!payments.ok) {
      if (!isDown(payments.error)) throw payments.error;
      this.logger.warn({ orderId: id, requestId }, 'payment unreachable; serving the order alone');
      degraded.push('payment');
    }
    if (!names.ok) {
      if (!isDown(names.error)) throw names.error;
      this.logger.warn({ orderId: id, requestId }, 'identity unreachable; no actor names');
      degraded.push('identity');
    }
    const nameOf = names.ok ? names.value : new Map<string, string | null>();

    const detail: AdminOrderDetailResponseDto = {
      ...base,
      history: base.history.map((entry, index) => {
        const actorUserId = order!.history[index]!.actorUserId ?? null;
        return {
          ...entry,
          actorUserId,
          actorName: actorUserId ? (nameOf.get(actorUserId) ?? null) : null,
        };
      }),
      payments: payments.ok ? payments.value.payments.map(toPaymentResponseDto) : null,
    };
    return degraded.length > 0 ? WithMeta.of(detail, { degraded }) : detail;
  }

  /**
   * The distinct users in a history (a handful: the customer, one or two staff), looked up in
   * parallel — no batch RPC for ≤ 3 ids. A user that no longer resolves is `null`; a deactivated
   * one still does.
   */
  private async namesOf(
    caller: Caller,
    history: readonly { actorUserId?: string }[],
    requestId?: string,
  ): Promise<Map<string, string | null>> {
    const ids = [...new Set(history.flatMap((h) => (h.actorUserId ? [h.actorUserId] : [])))];
    const entries = await Promise.all(
      ids.map(async (userId): Promise<[string, string | null]> => {
        try {
          const { user } = await this.identity.getUser(caller, { id: userId }, requestId);
          return [userId, user?.fullName ?? null];
        } catch (error) {
          if (isNotFound(error)) return [userId, null];
          throw error;
        }
      }),
    );
    return new Map(entries);
  }
}
