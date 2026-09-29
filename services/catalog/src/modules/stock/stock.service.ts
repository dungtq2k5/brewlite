import { Injectable } from '@nestjs/common';
import {
  compareStrings,
  MAX_MENU_PRODUCTS,
  ReservationStatus,
  STOCK_RESERVE_MAX_RETRIES,
} from '@brewlite/contracts';
import { live, rpcError } from '@brewlite/nest-common';
import type {
  ListStaffProductsRequest,
  ListStaffProductsResponse,
  ReleaseStockRequest,
  ReleaseStockResponse,
  ReserveStockRequest,
  ReserveStockResponse,
  SetProductAvailabilityRequest,
  SetProductAvailabilityResponse,
  SetStockQtyRequest,
  SetStockQtyResponse,
  SetToppingAvailabilityRequest,
  SetToppingAvailabilityResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MenuCache } from '../menu/menu-cache.service.js';
import {
  STAFF_PRODUCT_SELECT,
  STAFF_TOPPING_SELECT,
  toProtoStaffProduct,
  toProtoStaffTopping,
} from './staff-product.mapper.js';
import {
  STOCK_RESERVATION_SELECT,
  toProtoStockReservation,
  type StockReservationRow,
} from './stock-reservation.mapper.js';

const STAFF_PRODUCT_ORDER_BY = [
  { category: { sortOrder: 'asc' as const } },
  { categoryId: 'asc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MenuCache,
  ) {}

  /** Every live product, inactive categories included — staff still sell out a hidden drink. */
  async listStaffProducts(_request: ListStaffProductsRequest): Promise<ListStaffProductsResponse> {
    const rows = await this.prisma.product.findMany({
      where: { ...live },
      orderBy: STAFF_PRODUCT_ORDER_BY,
      take: MAX_MENU_PRODUCTS,
      select: STAFF_PRODUCT_SELECT,
    });
    return { products: rows.map(toProtoStaffProduct) };
  }

  /** Never bumps `version` — `version` guards `stock_qty` only. */
  async setProductAvailability(
    request: SetProductAvailabilityRequest,
  ): Promise<SetProductAvailabilityResponse> {
    const { count } = await this.prisma.product.updateMany({
      where: { id: request.id, ...live },
      data: { isAvailable: request.isAvailable },
    });
    if (count === 0) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PRODUCT' });
    await this.cache.invalidate();
    const row = await this.prisma.product.findFirstOrThrow({
      where: { id: request.id },
      select: STAFF_PRODUCT_SELECT,
    });
    return { product: toProtoStaffProduct(row) };
  }

  /**
   * The same predicate as a reservation (conventions §7.6): a staff edit and an order
   * racing on one product — one wins, the other retries (the order) or reloads (staff).
   * No retry here — a human re-enters (api §2.2).
   */
  async setStockQty(request: SetStockQtyRequest): Promise<SetStockQtyResponse> {
    const { count } = await this.prisma.product.updateMany({
      where: { id: request.id, ...live, version: request.expectedVersion },
      data: { stockQty: request.stockQty ?? null, version: { increment: 1 } },
    });
    if (count === 0) {
      const current = await this.prisma.product.findFirst({
        where: { id: request.id, ...live },
        select: { version: true, stockQty: true },
      });
      if (!current) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PRODUCT' });
      throw rpcError('STOCK_VERSION_CONFLICT', {
        currentVersion: current.version,
        currentStockQty: current.stockQty,
      });
    }
    await this.cache.invalidate();
    const row = await this.prisma.product.findFirstOrThrow({
      where: { id: request.id },
      select: STAFF_PRODUCT_SELECT,
    });
    return { product: toProtoStaffProduct(row) };
  }

  async setToppingAvailability(
    request: SetToppingAvailabilityRequest,
  ): Promise<SetToppingAvailabilityResponse> {
    const { count } = await this.prisma.topping.updateMany({
      where: { id: request.id, ...live },
      data: { isAvailable: request.isAvailable },
    });
    if (count === 0) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'TOPPING' });
    await this.cache.invalidate();
    const row = await this.prisma.topping.findFirstOrThrow({
      where: { id: request.id },
      select: STAFF_TOPPING_SELECT,
    });
    return { topping: toProtoStaffTopping(row) };
  }

  /**
   * ADR 0018 — reserved under optimistic locking, one transaction. A retry (the same
   * `orderId` again) is a no-op: it returns the rows already there, never re-decrements.
   */
  async reserveStock(request: ReserveStockRequest): Promise<ReserveStockResponse> {
    const existing = await this.prisma.stockReservation.findMany({
      where: { orderId: request.orderId },
      select: STOCK_RESERVATION_SELECT,
    });
    if (existing.length > 0) {
      return { reservations: existing.map(toProtoStockReservation) };
    }

    const qtyByProduct = new Map<string, number>();
    for (const line of request.lines) {
      qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty);
    }
    // Sorted so two orders sharing products always lock-step in the same order and
    // never retry each other in circles (conventions §7.6).
    const productIds = [...qtyByProduct.keys()].sort(compareStrings);

    let crossedToZero = false;
    const created = await this.prisma.$transaction(async (tx) => {
      const unavailableIds: string[] = [];
      const shortages: { productId: string; available: number }[] = [];
      let contended = false;
      const rows: StockReservationRow[] = [];

      for (const productId of productIds) {
        const qty = qtyByProduct.get(productId)!;
        let current = await tx.product.findFirst({
          where: { id: productId },
          select: { version: true, stockQty: true, isAvailable: true, deletedAt: true },
        });
        // Not found, or not a counted product — nothing to reserve, no row, no refusal.
        if (!current || current.stockQty === null) continue;

        for (let attempt = 0; ; attempt++) {
          const { count } = await tx.product.updateMany({
            where: {
              id: productId,
              version: current.version,
              isAvailable: true,
              deletedAt: null,
              stockQty: { gte: qty },
            },
            data: { stockQty: { decrement: qty }, version: { increment: 1 } },
          });
          if (count === 1) {
            const row = await tx.stockReservation.create({
              data: { orderId: request.orderId, productId, qty, status: ReservationStatus.HELD },
              select: STOCK_RESERVATION_SELECT,
            });
            rows.push(row);
            if (current.stockQty - qty === 0) crossedToZero = true;
            break;
          }

          current = await tx.product.findFirst({
            where: { id: productId },
            select: { version: true, stockQty: true, isAvailable: true, deletedAt: true },
          });
          if (!current || current.deletedAt !== null || !current.isAvailable) {
            unavailableIds.push(productId);
            break;
          }
          if (current.stockQty === null) break; // no longer counted between reads
          if (current.stockQty < qty) {
            shortages.push({ productId, available: current.stockQty });
            break;
          }
          if (attempt + 1 >= STOCK_RESERVE_MAX_RETRIES) {
            contended = true;
            break;
          }
        }
      }

      // Every short product is named, not just the first — the loop above never stops
      // early, so the rollback below undoes whatever the other lines took.
      if (unavailableIds.length > 0) {
        throw rpcError('PRODUCT_UNAVAILABLE', { productIds: unavailableIds });
      }
      if (shortages.length > 0) throw rpcError('OUT_OF_STOCK', { products: shortages });
      if (contended) throw rpcError('STOCK_CONTENDED');
      return rows;
    });

    if (crossedToZero) await this.cache.invalidate();
    return { reservations: created.map(toProtoStockReservation) };
  }

  /** A second call for the same order finds nothing `HELD`/`CONFIRMED` left and does nothing. */
  async releaseStock(request: ReleaseStockRequest): Promise<ReleaseStockResponse> {
    const released = await this.releaseForOrder(request.orderId);
    return { reservations: released.map(toProtoStockReservation) };
  }

  /**
   * The body of `ReleaseStock`, shared with the order-status consumer's `CANCELLED`
   * effect (architecture §2.3) — idempotent by the same conditional write either caller uses.
   */
  async releaseForOrder(orderId: string): Promise<StockReservationRow[]> {
    let crossedFromZero = false;
    const released = await this.prisma.$transaction(async (tx) => {
      const targets = await tx.stockReservation.findMany({
        where: {
          orderId,
          status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
        },
        select: STOCK_RESERVATION_SELECT,
      });

      const rows: StockReservationRow[] = [];
      for (const target of targets) {
        const { count } = await tx.stockReservation.updateMany({
          where: {
            orderId: target.orderId,
            productId: target.productId,
            status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
          },
          data: { status: ReservationStatus.RELEASED },
        });
        if (count !== 1) continue;
        const product = await tx.product.update({
          where: { id: target.productId },
          data: { stockQty: { increment: target.qty }, version: { increment: 1 } },
          select: { stockQty: true },
        });
        if (product.stockQty === target.qty) crossedFromZero = true;
        rows.push({ ...target, status: ReservationStatus.RELEASED });
      }
      return rows;
    });

    if (crossedFromZero) await this.cache.invalidate();
    return released;
  }

  /** `PAID` confirms a `HELD` reservation — the stock was already taken (rdm-spec C-6). */
  async confirmForOrder(orderId: string): Promise<number> {
    const { count } = await this.prisma.stockReservation.updateMany({
      where: { orderId, status: ReservationStatus.HELD },
      data: { status: ReservationStatus.CONFIRMED },
    });
    return count;
  }
}
