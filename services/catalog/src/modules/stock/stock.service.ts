import { Injectable } from '@nestjs/common';
import { MAX_MENU_PRODUCTS } from '@brewlite/contracts';
import { live, rpcError } from '@brewlite/nest-common';
import type {
  ListStaffProductsRequest,
  ListStaffProductsResponse,
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
}
