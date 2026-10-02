import { Injectable } from '@nestjs/common';
import {
  computeUnitPrice,
  MAX_MENU_CATEGORIES,
  MAX_MENU_PRODUCTS,
  MAX_TOPPINGS_PER_LINE,
} from '@brewlite/contracts';
import { live, rpcError } from '@brewlite/nest-common';
import type {
  GetProductRequest,
  GetProductResponse,
  ListCategoriesRequest,
  ListCategoriesResponse,
  ListProductsRequest,
  ListProductsResponse,
  PriceItemsRequest,
  PriceItemsResponse,
  PricedLine,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CATEGORY_MENU_SELECT, toProtoCategory } from './category.mapper.js';
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_SUMMARY_SELECT,
  toProtoProductDetail,
  toProtoProductSummary,
} from './product.mapper.js';
import { ImageUrlBuilder } from './image-url-builder.service.js';
import { MenuCache } from './menu-cache.service.js';
import { toJsonPointer, zPriceItemsRequest } from './domain/price-items-request.js';

const PRODUCT_ORDER_BY = [
  { category: { sortOrder: 'asc' as const } },
  { categoryId: 'asc' as const },
  { sortOrder: 'asc' as const },
  { id: 'asc' as const },
];

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MenuCache,
    private readonly imageUrls: ImageUrlBuilder,
  ) {}

  async listCategories(_request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    const rows = await this.prisma.category.findMany({
      where: { ...live, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: MAX_MENU_CATEGORIES,
      select: CATEGORY_MENU_SELECT,
    });
    return { categories: rows.map(toProtoCategory) };
  }

  async listProducts(request: ListProductsRequest): Promise<ListProductsResponse> {
    const menu = await this.cache.getOrLoad(() => this.loadMenu());
    if (!request.categoryId) return menu;
    return { products: menu.products.filter((p) => p.categoryId === request.categoryId) };
  }

  private async loadMenu(): Promise<ListProductsResponse> {
    const rows = await this.prisma.product.findMany({
      where: { ...live, category: { ...live, isActive: true } },
      orderBy: PRODUCT_ORDER_BY,
      take: MAX_MENU_PRODUCTS,
      select: PRODUCT_SUMMARY_SELECT,
    });
    return {
      products: rows.map((row) => toProtoProductSummary(row, this.imageUrls.build(row.imagePath))),
    };
  }

  async getProduct(request: GetProductRequest): Promise<GetProductResponse> {
    const row = await this.prisma.product.findFirst({
      where: { id: request.id, ...live, category: { ...live, isActive: true } },
      select: PRODUCT_DETAIL_SELECT,
    });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PRODUCT' });
    return { product: toProtoProductDetail(row, this.imageUrls.build(row.imagePath)) };
  }

  async priceItems(request: PriceItemsRequest): Promise<PriceItemsResponse> {
    const parsed = zPriceItemsRequest.safeParse(request);
    if (!parsed.success) {
      throw rpcError('VALIDATION_FAILED', {
        issues: parsed.error.issues.map((issue) => ({
          path: toJsonPointer(issue.path),
          code: issue.code,
        })),
      });
    }
    const { lines } = parsed.data;

    const productIds = [...new Set(lines.map((l) => l.productId))];
    const toppingIds = [...new Set(lines.flatMap((l) => l.toppingIds))];

    const [products, toppings] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: true, sizes: true, toppings: { select: { toppingId: true } } },
      }),
      this.prisma.topping.findMany({ where: { id: { in: toppingIds } } }),
    ]);
    const productById = new Map(products.map((p) => [p.id, p]));
    const toppingById = new Map(toppings.map((t) => [t.id, t]));

    // 1. PRODUCT_UNAVAILABLE — every missing/deleted/inactive-category/unavailable product, deduplicated, in request order.
    const unavailableIds: string[] = [];
    for (const productId of productIds) {
      const product = productById.get(productId);
      const unavailable =
        !product ||
        product.deletedAt !== null ||
        product.category.deletedAt !== null ||
        !product.category.isActive ||
        !product.isAvailable;
      if (unavailable) unavailableIds.push(productId);
    }
    if (unavailableIds.length > 0) {
      throw rpcError('PRODUCT_UNAVAILABLE', { productIds: unavailableIds });
    }

    // 2. OPTION_INVALID — the first line (lowest index), checked SIZE, then TOO_MANY_TOPPINGS, then TOPPING.
    for (const [lineIndex, line] of lines.entries()) {
      const product = productById.get(line.productId)!;
      const offersSize = product.sizes.some((s) => s.size === line.size);
      if (!offersSize) {
        throw rpcError('OPTION_INVALID', { lineIndex, reason: 'SIZE' });
      }
      if (line.toppingIds.length > MAX_TOPPINGS_PER_LINE) {
        throw rpcError('OPTION_INVALID', { lineIndex, reason: 'TOO_MANY_TOPPINGS' });
      }
      const allowedToppingIds = new Set(product.toppings.map((t) => t.toppingId));
      const seenToppingIds = new Set<string>();
      for (const toppingId of line.toppingIds) {
        const topping = toppingById.get(toppingId);
        const invalid =
          !allowedToppingIds.has(toppingId) ||
          !topping ||
          topping.deletedAt !== null ||
          !topping.isAvailable ||
          seenToppingIds.has(toppingId);
        if (invalid) {
          throw rpcError('OPTION_INVALID', { lineIndex, reason: 'TOPPING' });
        }
        seenToppingIds.add(toppingId);
      }
    }

    // 3. OUT_OF_STOCK — read-only check, summed per counted product.
    const qtyByProduct = new Map<string, number>();
    for (const line of lines) {
      qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.qty);
    }
    const shortProducts: { productId: string; available: number }[] = [];
    for (const [productId, qty] of qtyByProduct) {
      const product = productById.get(productId)!;
      if (product.stockQty !== null && qty > product.stockQty) {
        shortProducts.push({ productId, available: product.stockQty });
      }
    }
    if (shortProducts.length > 0) {
      throw rpcError('OUT_OF_STOCK', { products: shortProducts });
    }

    // The answer — caller's lines, in order.
    const pricedLines: PricedLine[] = lines.map((line) => {
      const product = productById.get(line.productId)!;
      const sizeRow = product.sizes.find((s) => s.size === line.size)!;
      const toppingRows = line.toppingIds.map((id) => toppingById.get(id)!);
      const unitPriceVnd = computeUnitPrice(
        product.basePriceVnd,
        sizeRow.priceDeltaVnd,
        toppingRows.map((t) => t.priceVnd),
      );
      return {
        productId: line.productId,
        productName: { en: product.nameEn, vi: product.nameVi },
        size: line.size,
        basePriceVnd: product.basePriceVnd,
        sizeDeltaVnd: sizeRow.priceDeltaVnd,
        toppings: toppingRows.map((t) => ({
          id: t.id,
          name: { en: t.nameEn, vi: t.nameVi },
          priceVnd: t.priceVnd,
        })),
        unitPriceVnd,
        qty: line.qty,
        lineTotalVnd: unitPriceVnd * line.qty,
      };
    });
    const subtotalVnd = pricedLines.reduce((sum, line) => sum + line.lineTotalVnd, 0);

    return { lines: pricedLines, subtotalVnd: String(subtotalVnd) };
  }
}
