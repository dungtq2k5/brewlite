import { Injectable, Logger } from '@nestjs/common';
import { Locale, newId, zText } from '@brewlite/contracts';
import {
  isUniqueConstraintViolation,
  requireUser,
  rpcError,
  type Caller,
} from '@brewlite/nest-common';
import type {
  ClearImageRequest,
  ClearImageResponse,
  CreateProductRequest,
  CreateProductResponse,
  DeleteProductRequest,
  DeleteProductResponse,
  AdminMenuServiceGetProductRequest,
  AdminMenuServiceGetProductResponse,
  AdminMenuServiceListProductsRequest,
  AdminMenuServiceListProductsResponse,
  ReplaceSizesRequest,
  ReplaceSizesResponse,
  ReplaceToppingsRequest,
  ReplaceToppingsResponse,
  RestoreProductRequest,
  RestoreProductResponse,
  SetImageRequest,
  SetImageResponse,
  UpdateProductRequest,
  UpdateProductResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { detectImageType } from '../../domain/image-type.js';
import { FirebaseStorageProvider } from '../../providers/storage/firebase.storage-provider.js';
import { ImageUrlBuilder } from '../menu/image-url-builder.service.js';
import { MenuCache } from '../menu/menu-cache.service.js';
import {
  ADMIN_PRODUCT_LIST_SELECT,
  ADMIN_PRODUCT_SELECT,
  toProtoAdminProduct,
  toProtoAdminProductListItem,
  type AdminProductRow,
} from './admin-product.mapper.js';
import { lockCategory } from './lock-category.js';

const CONTENT_TYPE_BY_EXT = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

const zSearchQuery = zText(100);

function escapeLikePattern(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toOrderBy(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  return [{ [field]: descending ? 'desc' : 'asc' }, { id: 'asc' }];
}

function throwIfNameTaken(error: unknown): void {
  if (isUniqueConstraintViolation(error, 'products_name_en_live_key')) {
    throw rpcError('PRODUCT_NAME_TAKEN', { locale: Locale.EN });
  }
  if (isUniqueConstraintViolation(error, 'products_name_vi_live_key')) {
    throw rpcError('PRODUCT_NAME_TAKEN', { locale: Locale.VI });
  }
}

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MenuCache,
    private readonly imageUrls: ImageUrlBuilder,
    private readonly storage: FirebaseStorageProvider,
  ) {}

  async listProducts(
    request: AdminMenuServiceListProductsRequest,
  ): Promise<AdminMenuServiceListProductsResponse> {
    const page = request.page?.page ?? 1;
    const pageSize = request.page?.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {
      deletedAt: request.deleted === true ? { not: null } : null,
      ...(request.categoryId !== undefined && { categoryId: request.categoryId }),
      ...(request.q !== undefined &&
        (() => {
          const term = escapeLikePattern(zSearchQuery.parse(request.q));
          return {
            OR: [
              { nameEn: { contains: term, mode: 'insensitive' as const } },
              { nameVi: { contains: term, mode: 'insensitive' as const } },
            ],
          };
        })()),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: ADMIN_PRODUCT_LIST_SELECT,
        orderBy: toOrderBy(request.page?.sort ?? 'sortOrder'),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: rows.map((row) =>
        toProtoAdminProductListItem(row, this.imageUrls.build(row.imagePath)),
      ),
      meta: { page, pageSize, total },
    };
  }

  async getProduct(
    request: AdminMenuServiceGetProductRequest,
  ): Promise<AdminMenuServiceGetProductResponse> {
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  async createProduct(request: CreateProductRequest): Promise<CreateProductResponse> {
    const created = await this.prisma.$transaction(async (tx) => {
      const categoryLive = await lockCategory(tx, request.categoryId, 'SHARE');
      if (!categoryLive) throw rpcError('RESOURCE_REFERENCE_INVALID', { field: 'categoryId' });

      if (request.toppingIds.length > 0) {
        const liveCount = await tx.topping.count({
          where: { id: { in: request.toppingIds }, deletedAt: null },
        });
        if (liveCount !== request.toppingIds.length) {
          throw rpcError('RESOURCE_REFERENCE_INVALID', { field: 'toppingIds' });
        }
      }

      try {
        return await tx.product.create({
          data: {
            id: newId(),
            categoryId: request.categoryId,
            nameEn: request.name!.en,
            nameVi: request.name!.vi,
            descriptionEn: request.description?.en,
            descriptionVi: request.description?.vi,
            basePriceVnd: request.basePriceVnd,
            stockQty: request.stockQty ?? null,
            sortOrder: request.sortOrder ?? 0,
            sizes: {
              create: request.sizes.map((s) => ({ size: s.size, priceDeltaVnd: s.priceDeltaVnd })),
            },
            toppings: { create: request.toppingIds.map((id) => ({ toppingId: id })) },
          },
        });
      } catch (error) {
        throwIfNameTaken(error);
        throw error;
      }
    });
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(created.id)) };
  }

  /** A moved product locks its new category like Create. Not `stockQty` (staff's version lock), not `isAvailable` (staff's). */
  async updateProduct(request: UpdateProductRequest): Promise<UpdateProductResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.$transaction(async (tx) => {
      if (request.categoryId !== undefined) {
        const categoryLive = await lockCategory(tx, request.categoryId, 'SHARE');
        if (!categoryLive) throw rpcError('RESOURCE_REFERENCE_INVALID', { field: 'categoryId' });
      }
      try {
        await tx.product.update({
          where: { id: request.id },
          data: {
            ...(request.categoryId !== undefined && { categoryId: request.categoryId }),
            ...(request.name !== undefined && { nameEn: request.name.en, nameVi: request.name.vi }),
            ...(request.clearDescription === true
              ? { descriptionEn: null, descriptionVi: null }
              : request.description !== undefined
                ? { descriptionEn: request.description.en, descriptionVi: request.description.vi }
                : {}),
            ...(request.basePriceVnd !== undefined && { basePriceVnd: request.basePriceVnd }),
            ...(request.sortOrder !== undefined && { sortOrder: request.sortOrder }),
          },
        });
      } catch (error) {
        throwIfNameTaken(error);
        throw error;
      }
    });
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  async replaceSizes(request: ReplaceSizesRequest): Promise<ReplaceSizesResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.$transaction([
      this.prisma.productSize.deleteMany({ where: { productId: request.id } }),
      this.prisma.productSize.createMany({
        data: request.sizes.map((s) => ({
          productId: request.id,
          size: s.size,
          priceDeltaVnd: s.priceDeltaVnd,
        })),
      }),
    ]);
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  async replaceToppings(request: ReplaceToppingsRequest): Promise<ReplaceToppingsResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    if (request.toppingIds.length > 0) {
      const liveCount = await this.prisma.topping.count({
        where: { id: { in: request.toppingIds }, deletedAt: null },
      });
      if (liveCount !== request.toppingIds.length) {
        throw rpcError('RESOURCE_REFERENCE_INVALID', { field: 'toppingIds' });
      }
    }

    await this.prisma.$transaction([
      this.prisma.productTopping.deleteMany({ where: { productId: request.id } }),
      this.prisma.productTopping.createMany({
        data: request.toppingIds.map((id) => ({ productId: request.id, toppingId: id })),
      }),
    ]);
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  /** Existing orders and held reservations are unaffected — soft delete only. */
  async deleteProduct(
    request: DeleteProductRequest,
    caller: Caller,
  ): Promise<DeleteProductResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.product.update({
      where: { id: request.id },
      data: { deletedAt: new Date(), deletedById: actorId },
    });
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  async restoreProduct(request: RestoreProductRequest): Promise<RestoreProductResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt === null) throw rpcError('INVALID_STATE', { status: 'ACTIVE' });

    await this.prisma.$transaction(async (tx) => {
      const categoryLive = await lockCategory(tx, target.categoryId, 'SHARE');
      if (!categoryLive) throw rpcError('INVALID_STATE', { status: 'CATEGORY_DELETED' });
      try {
        await tx.product.update({
          where: { id: request.id },
          data: { deletedAt: null, deletedById: null },
        });
      } catch (error) {
        throwIfNameTaken(error);
        throw error;
      }
    });
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  /**
   * Upload before the write, delete the old object after commit (architecture §3.4). A
   * crash between the two, or a failed cleanup below, leaves an accepted orphan object —
   * never a row pointing at nothing.
   */
  async setImage(request: SetImageRequest): Promise<SetImageResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    const type = detectImageType(request.content);
    if (type === null) throw rpcError('IMAGE_INVALID', { reason: 'TYPE' });

    const newPath = `products/${request.id}/${newId()}.${type}`;
    await this.storage.save(newPath, request.content, CONTENT_TYPE_BY_EXT[type]);
    try {
      await this.prisma.product.update({ where: { id: request.id }, data: { imagePath: newPath } });
    } catch (error) {
      await this.deleteObjectBestEffort(newPath);
      throw error;
    }
    if (target.imagePath !== null) await this.deleteObjectBestEffort(target.imagePath);
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  async clearImage(request: ClearImageRequest): Promise<ClearImageResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.product.update({ where: { id: request.id }, data: { imagePath: null } });
    if (target.imagePath !== null) await this.deleteObjectBestEffort(target.imagePath);
    await this.cache.invalidate();
    return { product: this.toProduct(await this.findByIdIncludingDeleted(request.id)) };
  }

  private async deleteObjectBestEffort(path: string): Promise<void> {
    try {
      await this.storage.delete(path);
    } catch (error) {
      this.logger.warn({ err: error, path }, 'storage object delete failed');
    }
  }

  private toProduct(row: AdminProductRow) {
    return toProtoAdminProduct(row, this.imageUrls.build(row.imagePath));
  }

  private async findByIdIncludingDeleted(id: string): Promise<AdminProductRow> {
    const row = await this.prisma.product.findFirst({
      where: { id },
      select: ADMIN_PRODUCT_SELECT,
    });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'PRODUCT' });
    return row;
  }
}
