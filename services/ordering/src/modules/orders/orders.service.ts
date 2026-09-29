import { Injectable, Logger } from '@nestjs/common';
import {
  contentHash,
  isGrpcServiceError,
  isUniqueConstraintViolation,
  OutboxService,
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
  pointsEarnable,
} from '@brewlite/contracts';
import type {
  CancelOrderRequest,
  CancelOrderResponse,
  GetOrderRequest,
  GetOrderResponse,
  ListMyOrdersRequest,
  ListMyOrdersResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  QuoteRequest,
  QuoteResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/order_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertTransition } from './domain/order-lifecycle.js';
import { rethrowCatalogError } from './domain/catalog-errors.js';
import { CatalogMenuGrpcClient } from './catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { toOrderLineFromPriced, toProtoOrder } from './order.mapper.js';

export interface TransitionActor {
  type: OrderActorType;
  userId?: string;
}

const ORDER_STATUS_SELECT = {
  id: true,
  orderNo: true,
  userId: true,
  status: true,
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

    await tx.orderStatusHistory.create({
      data: {
        id: newId(),
        orderId,
        fromStatus: current.status,
        toStatus: to,
        actorType: actor.type,
        actorUserId: actor.userId ?? null,
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
    requireUser(caller);
    const priced = await this.priceItemsOrThrow(request.items);
    const subtotalVnd = Number(priced.subtotalVnd);
    this.assertOrderChecks(request.promoCode, subtotalVnd);

    return {
      lines: priced.lines.map(toOrderLineFromPriced),
      subtotalVnd: priced.subtotalVnd,
      promoDiscountVnd: 0,
      pointsDiscountVnd: 0,
      totalVnd: priced.subtotalVnd,
      promoCode: undefined,
      pointsEarnable: pointsEarnable(subtotalVnd),
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
    this.assertOrderChecks(request.promoCode, subtotalVnd);

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
        await tx.order.create({
          data: {
            id: orderId,
            userId,
            status: OrderStatus.PENDING,
            subtotalVnd,
            totalVnd: subtotalVnd,
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
      // The orphan sweep (05b) is the backstop for a crash between here and the catch.
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
   * `HELD` — releasing it is the catalog consumer's job once 05b publishes this event.
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

  /** api-endpoints-plan §3.2's refusal order, after pricing — shared by Quote and PlaceOrder. */
  private assertOrderChecks(promoCode: string | undefined, totalVnd: number): void {
    if (promoCode !== undefined) throw rpcError('PROMO_CODE_INVALID', { reason: 'NOT_FOUND' });
    if (totalVnd < MIN_PAYABLE_VND) {
      throw rpcError('ORDER_TOTAL_TOO_LOW', { minimumVnd: MIN_PAYABLE_VND });
    }
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
