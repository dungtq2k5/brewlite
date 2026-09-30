import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import {
  contentHash,
  isGrpcServiceError,
  isUniqueConstraintViolation,
  OutboxService,
  PoisonMessage,
  requireUser,
  rpcError,
  type Caller,
} from '@brewlite/nest-common';
import {
  CancelReason,
  DEFAULT_PAGE_SIZE,
  GrpcStatus,
  MAX_ORDER_TOTAL_VND,
  MIN_PAYABLE_VND,
  newId,
  normalizeText,
  ORDER_UNPAID_TTL_MS,
  OrderActorType,
  OrderStatus,
  parseEnum,
  PAYMENT_WINDOW_MS,
  pointsEarnable,
  type EventPayload,
} from '@brewlite/contracts';
import type {
  BeginPaymentRequest,
  BeginPaymentResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  GetOrderRequest,
  GetOrderResponse,
  GetOrderStatusRequest,
  GetOrderStatusResponse,
  ListMyOrdersRequest,
  ListMyOrdersResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  QuoteRequest,
  QuoteResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionEvaluationService } from '../promotions/promotion-evaluation.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { assertTransition } from './domain/order-lifecycle.js';
import { rethrowCatalogError } from './domain/catalog-errors.js';
import { CatalogMenuGrpcClient } from './catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { toOrderLineFromPriced, toProtoOrder } from './order.mapper.js';

export interface TransitionActor {
  type: OrderActorType;
  userId?: string;
}

/** `transition()` throws a local `RpcException` — its code sits inside `getError()`, unlike a peer's `ServiceError`. */
function rpcErrorCode(error: unknown): string | undefined {
  if (!(error instanceof RpcException)) return undefined;
  const err = error.getError();
  if (typeof err !== 'object' || err === null || !('metadata' in err)) return undefined;
  return (err as { metadata: Metadata }).metadata.get('bl-error-code')[0]?.toString();
}

const ORDER_STATUS_SELECT = {
  id: true,
  orderNo: true,
  userId: true,
  status: true,
  promotionId: true,
  totalVnd: true,
} satisfies Prisma.OrderSelect;

export type OrderStatusRow = Prisma.OrderGetPayload<{ select: typeof ORDER_STATUS_SELECT }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly catalogMenu: CatalogMenuGrpcClient,
    private readonly catalogStock: CatalogStockGrpcClient,
    private readonly promotions: PromotionEvaluationService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /**
   * Every status write goes through this one helper (§3.4). Step 3's conditional
   * update is what makes two taps, or a tap racing the expiry job, impossible to both
   * succeed (conventions §7.5) — never `update({ where: { id } })`.
   */
  async transition(
    tx: Prisma.TransactionClient,
    orderId: string,
    where: Prisma.OrderWhereInput,
    to: OrderStatus,
    actor: TransitionActor,
    data: Prisma.OrderUpdateInput = {},
    note?: string,
  ): Promise<OrderStatusRow> {
    const current = await tx.order.findFirst({
      where: { id: orderId, ...where },
      select: ORDER_STATUS_SELECT,
    });
    if (!current) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });
    assertTransition(current.status as OrderStatus, to);

    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: current.status, ...where },
      data: { status: to, ...data },
    });
    if (count === 0) {
      const fresh = await tx.order.findFirstOrThrow({
        where: { id: orderId, ...where },
        select: ORDER_STATUS_SELECT,
      });
      throw rpcError('INVALID_STATE', { status: fresh.status });
    }

    // Every cancel path gives the promo use back and reverses any earned points — runs
    // after the conditional update above, so a cancel that loses its race changes
    // neither the count nor the ledger.
    if (to === OrderStatus.CANCELLED) {
      if (current.promotionId) {
        await tx.promotion.updateMany({
          where: { id: current.promotionId, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
      await this.loyalty.reverse(tx, current);
    }

    await tx.orderStatusHistory.create({
      data: {
        id: newId(),
        orderId,
        fromStatus: current.status,
        toStatus: to,
        actorType: actor.type,
        actorUserId: actor.userId ?? null,
        note,
      },
    });

    const cancelReason =
      typeof data.cancelReason === 'string' ? (data.cancelReason as CancelReason) : undefined;
    const paymentId =
      typeof data.currentPaymentId === 'string' ? (data.currentPaymentId as string) : undefined;

    await this.outbox.add(tx, 'ordering.order.status_changed', orderId, {
      orderId,
      orderNo: current.orderNo.toString(),
      userId: current.userId,
      from: current.status as OrderStatus,
      to,
      actorType: actor.type,
      paymentId,
      cancelReason,
    });

    return tx.order.findFirstOrThrow({ where: { id: orderId }, select: ORDER_STATUS_SELECT });
  }

  /** Prices through catalog and validates the code; writes nothing, reserves nothing. */
  async quote(request: QuoteRequest, caller: Caller): Promise<QuoteResponse> {
    const { userId } = requireUser(caller);
    const priced = await this.priceItemsOrThrow(request.items);
    const subtotalVnd = Number(priced.subtotalVnd);
    this.assertSubtotalChecks(subtotalVnd);

    let promoDiscountVnd = 0;
    if (request.promoCode !== undefined) {
      const evaluation = await this.promotions.evaluate(
        request.promoCode,
        subtotalVnd,
        userId,
        new Date(),
      );
      promoDiscountVnd = evaluation.discountVnd;
    }
    const totalVnd = subtotalVnd - promoDiscountVnd;
    this.assertTotalChecks(totalVnd);

    return {
      lines: priced.lines.map(toOrderLineFromPriced),
      subtotalVnd: priced.subtotalVnd,
      promoDiscountVnd,
      pointsDiscountVnd: 0,
      totalVnd: totalVnd.toString(),
      promoCode: request.promoCode,
      pointsEarnable: pointsEarnable(totalVnd),
    };
  }

  /** api-endpoints-plan §6.1 — the sequence this doc's own §4.3 pseudocode names. */
  async placeOrder(request: PlaceOrderRequest, caller: Caller): Promise<PlaceOrderResponse> {
    const { userId } = requireUser(caller);
    const idempotencyKey = request.idempotencyKey;
    const requestHash = contentHash({
      items: request.items.map((line) => ({
        productId: line.productId,
        size: line.size,
        toppingIds: [...line.toppingIds],
        qty: line.qty,
      })),
      note: request.note !== undefined ? normalizeText(request.note) : undefined,
      promoCode: request.promoCode !== undefined ? request.promoCode.toUpperCase() : undefined,
    });

    const existing = await this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) throw rpcError('IDEMPOTENCY_KEY_REUSED');
      return { order: await this.toFullOrder(existing.id), created: false };
    }

    const orderId = newId();
    const priced = await this.priceItemsOrThrow(request.items);
    const subtotalVnd = Number(priced.subtotalVnd);
    this.assertSubtotalChecks(subtotalVnd);

    // Step 4 (api §6.1): the same read-only evaluation as the quote — a cheap early
    // refusal before stock is ever reserved. Step 6, under the lock, is the real one.
    if (request.promoCode !== undefined) {
      await this.promotions.evaluate(request.promoCode, subtotalVnd, userId, new Date());
    }

    try {
      await this.catalogStock.reserveStock({
        orderId,
        lines: request.items.map((line) => ({ productId: line.productId, qty: line.qty })),
      });
    } catch (error) {
      // A timeout may still have committed server-side — release defensively. A clean
      // refusal (OUT_OF_STOCK, PRODUCT_UNAVAILABLE, STOCK_CONTENDED) reserved nothing.
      if (isGrpcServiceError(error) && error.code === GrpcStatus.DEADLINE_EXCEEDED) {
        await this.releaseStockBestEffort(orderId);
      }
      rethrowCatalogError(error);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        let promotionId: string | undefined;
        let promoDiscountVnd = 0;
        if (request.promoCode !== undefined) {
          const evaluation = await this.promotions.evaluateLocked(
            tx,
            request.promoCode,
            subtotalVnd,
            userId,
            new Date(),
          );
          promotionId = evaluation.promotionId;
          promoDiscountVnd = evaluation.discountVnd;
        }
        // The totals stored are the ones computed under the lock, not the step-4 preview.
        const totalVnd = subtotalVnd - promoDiscountVnd;
        this.assertTotalChecks(totalVnd);

        await tx.order.create({
          data: {
            id: orderId,
            userId,
            status: OrderStatus.PENDING,
            subtotalVnd,
            promoDiscountVnd,
            totalVnd,
            promotionId,
            promoCode: request.promoCode,
            idempotencyKey,
            requestHash,
            note: request.note,
            expiresAt: new Date(Date.now() + ORDER_UNPAID_TTL_MS),
          },
        });
        await tx.orderItem.createMany({
          data: priced.lines.map((line, index) => ({
            id: newId(),
            orderId,
            lineNo: index + 1,
            productId: line.productId,
            productNameEn: line.productName?.en ?? '',
            productNameVi: line.productName?.vi ?? '',
            size: line.size,
            basePriceVnd: line.basePriceVnd,
            sizeDeltaVnd: line.sizeDeltaVnd,
            toppings: line.toppings.map((t) => ({
              toppingId: t.id,
              nameEn: t.name?.en ?? '',
              nameVi: t.name?.vi ?? '',
              priceVnd: t.priceVnd,
            })),
            unitPriceVnd: line.unitPriceVnd,
            qty: line.qty,
            lineTotalVnd: line.lineTotalVnd,
          })),
        });
        await tx.orderStatusHistory.create({
          data: {
            id: newId(),
            orderId,
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            actorType: OrderActorType.CUSTOMER,
            actorUserId: userId,
          },
        });
      });
      return { order: await this.toFullOrder(orderId), created: true };
    } catch (error) {
      // The orphan sweep (rdm-spec C-6) is the backstop for a crash between here and the catch.
      await this.releaseStockBestEffort(orderId);
      if (isUniqueConstraintViolation(error, 'orders_user_idempotency_key')) {
        const winner = await this.prisma.order.findUniqueOrThrow({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        return { order: await this.toFullOrder(winner.id), created: false };
      }
      throw error;
    }
  }

  async listMyOrders(request: ListMyOrdersRequest, caller: Caller): Promise<ListMyOrdersResponse> {
    const { userId } = requireUser(caller);
    const limit = request.limit > 0 ? request.limit : DEFAULT_PAGE_SIZE;
    const cursorId =
      request.cursor !== undefined
        ? Buffer.from(request.cursor, 'base64url').toString('utf8')
        : undefined;

    const rows = await this.prisma.order.findMany({
      where: {
        userId,
        ...(request.status !== undefined && { status: parseEnum(OrderStatus, request.status) }),
        ...(cursorId !== undefined && { id: { lt: cursorId } }),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(page[page.length - 1]!.id, 'utf8').toString('base64url')
      : undefined;

    const orders = await Promise.all(
      page.map(async (row) => {
        const items = await this.prisma.orderItem.findMany({
          where: { orderId: row.id },
          orderBy: { lineNo: 'asc' },
        });
        return toProtoOrder(row, items, []);
      }),
    );

    return { orders, nextCursor };
  }

  /** Scoped in the query — someone else's order is simply not found (conventions §4.2). */
  async getOrder(request: GetOrderRequest, caller: Caller): Promise<GetOrderResponse> {
    const { userId } = requireUser(caller);
    const order = await this.prisma.order.findFirst({ where: { id: request.id, userId } });
    if (!order) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });
    return { order: await this.toFullOrder(order.id) };
  }

  /**
   * `assertTransition` allows this only from `PENDING`/`PAYMENT_FAILED`. The stock stays
   * `HELD` — releasing it is the catalog consumer's job once the relay publishes this event.
   */
  async cancelOrder(request: CancelOrderRequest, caller: Caller): Promise<CancelOrderResponse> {
    const { userId } = requireUser(caller);
    const updated = await this.prisma.$transaction((tx) =>
      this.transition(
        tx,
        request.id,
        { userId },
        OrderStatus.CANCELLED,
        { type: OrderActorType.CUSTOMER, userId },
        { cancelledAt: new Date(), cancelReason: CancelReason.CUSTOMER },
      ),
    );
    return { order: await this.toFullOrder(updated.id) };
  }

  /** Internal — no ownership check, no gateway route (api §9.2). */
  async getOrderStatus(request: GetOrderStatusRequest): Promise<GetOrderStatusResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: request.id },
      select: { status: true },
    });
    if (!order) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });
    return { status: order.status };
  }

  /**
   * Internal — no gateway route, called by payment only (api §9.2). `userId` is a
   * request field, not the metadata caller: payment is the caller, acting for the user
   * it authenticated through the gateway.
   */
  async beginPayment(request: BeginPaymentRequest): Promise<BeginPaymentResponse> {
    const { orderId, userId, paymentId } = request;
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { orderNo: true, totalVnd: true, status: true, expiresAt: true },
    });
    if (!order) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'ORDER' });

    const now = new Date();
    const isPayable =
      (order.status === OrderStatus.PENDING || order.status === OrderStatus.PAYMENT_FAILED) &&
      order.expiresAt > now;
    if (!isPayable) throw rpcError('ORDER_NOT_PAYABLE', { status: order.status as OrderStatus });

    const newExpiresAt = new Date(
      Math.max(order.expiresAt.getTime(), now.getTime() + PAYMENT_WINDOW_MS),
    );
    const payableWhere: Prisma.OrderWhereInput = {
      userId,
      status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
      expiresAt: { gt: now },
    };

    if (order.status === OrderStatus.PAYMENT_FAILED) {
      // The status actually changes — goes through transition() for its history row
      // and outbox event, like any other status change.
      await this.prisma.$transaction((tx) =>
        this.transition(
          tx,
          orderId,
          payableWhere,
          OrderStatus.PENDING,
          { type: OrderActorType.CUSTOMER, userId },
          { currentPaymentId: paymentId, expiresAt: newExpiresAt },
        ),
      );
    } else {
      // Already PENDING — no status change to record, just the conditional write.
      // `orders-expire` (05b) puts the same deadline in its own WHERE, so whichever
      // commits first wins and the other matches nothing.
      const { count } = await this.prisma.order.updateMany({
        where: { id: orderId, ...payableWhere },
        data: { currentPaymentId: paymentId, expiresAt: newExpiresAt },
      });
      if (count === 0) {
        const fresh = await this.prisma.order.findFirstOrThrow({
          where: { id: orderId, userId },
          select: { status: true },
        });
        throw rpcError('ORDER_NOT_PAYABLE', { status: fresh.status as OrderStatus });
      }
    }

    return { orderNo: order.orderNo.toString(), totalVnd: order.totalVnd.toString() };
  }

  /**
   * Paid past the deadline is still paid — no `expires_at` condition here (rdm-spec §1.2
   * rule 3). A payment for an order that does not exist, or for the wrong amount, is
   * always a bug — never a redelivery.
   */
  async applyPaymentSucceeded(payload: EventPayload<'payment.payment.succeeded'>): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: { id: true, userId: true, status: true, totalVnd: true },
    });
    if (!order) throw new PoisonMessage('payment for an order that does not exist');
    if (order.totalVnd !== payload.amountVnd) throw new PoisonMessage('amount mismatch');

    const status = order.status as OrderStatus;
    if (
      status === OrderStatus.PAID ||
      status === OrderStatus.PREPARING ||
      status === OrderStatus.READY ||
      status === OrderStatus.COMPLETED
    ) {
      return; // a redelivery — this order already saw this (or a later) payment succeed
    }
    if (status === OrderStatus.CANCELLED) {
      await this.rejectPayment(order.id, payload.paymentId, status);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await this.transition(
          tx,
          order.id,
          { status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] } },
          OrderStatus.PAID,
          { type: OrderActorType.PAYMENT },
          { paidAt: new Date(), currentPaymentId: payload.paymentId },
        );
        await this.loyalty.earn(tx, updated);
      });
    } catch (error) {
      // The expiry won the race between our read above and the conditional write —
      // re-read to confirm it landed on CANCELLED before rejecting.
      if (rpcErrorCode(error) !== 'INVALID_STATE') throw error;
      const fresh = await this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });
      if (fresh.status !== OrderStatus.CANCELLED) throw error;
      await this.rejectPayment(order.id, payload.paymentId, fresh.status as OrderStatus);
    }
  }

  private async rejectPayment(
    orderId: string,
    paymentId: string,
    orderStatus: OrderStatus,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.outbox.add(tx, 'ordering.payment.rejected', orderId, {
        orderId,
        paymentId,
        orderStatus,
      }),
    );
  }

  /**
   * A failure for a payment that is no longer the current one, or for an order that
   * already moved, changes nothing (api §8).
   */
  async applyPaymentFailed(payload: EventPayload<'payment.payment.failed'>): Promise<void> {
    try {
      await this.prisma.$transaction((tx) =>
        this.transition(
          tx,
          payload.orderId,
          { currentPaymentId: payload.paymentId, status: OrderStatus.PENDING },
          OrderStatus.PAYMENT_FAILED,
          { type: OrderActorType.PAYMENT },
          {},
          payload.reason,
        ),
      );
    } catch (error) {
      const code = rpcErrorCode(error);
      if (code === 'RESOURCE_NOT_FOUND' || code === 'INVALID_STATE') return;
      throw error;
    }
  }

  private async priceItemsOrThrow(
    items: PlaceOrderRequest['items'],
  ): Promise<Awaited<ReturnType<CatalogMenuGrpcClient['priceItems']>>> {
    try {
      return await this.catalogMenu.priceItems({
        lines: items.map((line) => ({
          productId: line.productId,
          size: line.size,
          toppingIds: line.toppingIds,
          qty: line.qty,
        })),
      });
    } catch (error) {
      rethrowCatalogError(error);
    }
  }

  /**
   * `ORDER_TOTAL_TOO_LOW` is judged on the subtotal, before any promo is evaluated — a
   * promo's own discount is capped so it can never push a valid-subtotal cart back below
   * `MIN_PAYABLE_VND` (`applyPromotion`'s clamp assumes this already holds).
   */
  private assertSubtotalChecks(subtotalVnd: number): void {
    if (subtotalVnd < MIN_PAYABLE_VND) {
      throw rpcError('ORDER_TOTAL_TOO_LOW', { minimumVnd: MIN_PAYABLE_VND });
    }
  }

  private assertTotalChecks(totalVnd: number): void {
    if (totalVnd > MAX_ORDER_TOTAL_VND) {
      throw rpcError('ORDER_TOTAL_TOO_HIGH', { maximumVnd: MAX_ORDER_TOTAL_VND });
    }
  }

  private async toFullOrder(orderId: string) {
    const [order, items, history] = await Promise.all([
      this.prisma.order.findUniqueOrThrow({ where: { id: orderId } }),
      this.prisma.orderItem.findMany({ where: { orderId }, orderBy: { lineNo: 'asc' } }),
      this.prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { id: 'asc' } }),
    ]);
    return toProtoOrder(order, items, history);
  }

  private async releaseStockBestEffort(orderId: string): Promise<void> {
    try {
      await this.catalogStock.releaseStock({ orderId });
    } catch (error) {
      this.logger.warn({ err: error, orderId }, 'ReleaseStock after a failed PlaceOrder failed');
    }
  }
}
