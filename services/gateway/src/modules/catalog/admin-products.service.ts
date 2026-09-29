import { Injectable } from '@nestjs/common';
import { Paged, type Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { CatalogAdminGrpcClient } from './catalog-admin-grpc.client.js';
import {
  toAdminProductListItemResponseDto,
  toAdminProductResponseDto,
} from './admin-product.mapper.js';
import type {
  AdminProductListItemResponseDto,
  AdminProductResponseDto,
  CreateProductDto,
  ListAdminProductsQueryDto,
  ReplaceSizesDto,
  ReplaceToppingsDto,
  UpdateProductDto,
} from './dto/admin-product.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class AdminProductsService {
  constructor(private readonly admin: CatalogAdminGrpcClient) {}

  async list(
    query: ListAdminProductsQueryDto,
    requestId?: string,
  ): Promise<Paged<AdminProductListItemResponseDto>> {
    const response = await this.admin.listProducts(
      {
        page: { page: query.page, pageSize: query.pageSize, sort: query.sort },
        q: query.q,
        categoryId: query.categoryId,
        deleted: query.deleted,
      },
      requestId,
    );
    return Paged.page(response.products.map(toAdminProductListItemResponseDto), response.meta!);
  }

  async get(id: string, requestId?: string): Promise<AdminProductResponseDto> {
    const response = await this.admin.getProduct({ id }, requestId);
    return toAdminProductResponseDto(response.product!);
  }

  async create(dto: CreateProductDto, requestId?: string): Promise<AdminProductResponseDto> {
    const response = await this.admin.createProduct(
      {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        basePriceVnd: dto.basePriceVnd,
        sizes: dto.sizes,
        toppingIds: dto.toppingIds,
        stockQty: dto.stockQty ?? undefined,
        sortOrder: dto.sortOrder,
      },
      requestId,
    );
    return toAdminProductResponseDto(response.product!);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    requestId?: string,
  ): Promise<AdminProductResponseDto> {
    const response = await this.admin.updateProduct(
      {
        id,
        categoryId: dto.categoryId,
        name: dto.name,
        // `null` clears both languages; absent leaves the description unchanged.
        description: dto.description === null ? undefined : dto.description,
        clearDescription: dto.description === null ? true : undefined,
        basePriceVnd: dto.basePriceVnd,
        sortOrder: dto.sortOrder,
      },
      requestId,
    );
    return toAdminProductResponseDto(response.product!);
  }

  async replaceSizes(
    id: string,
    dto: ReplaceSizesDto,
    requestId?: string,
  ): Promise<AdminProductResponseDto> {
    const response = await this.admin.replaceSizes({ id, sizes: dto.sizes }, requestId);
    return toAdminProductResponseDto(response.product!);
  }

  async replaceToppings(
    id: string,
    dto: ReplaceToppingsDto,
    requestId?: string,
  ): Promise<AdminProductResponseDto> {
    const response = await this.admin.replaceToppings(
      { id, toppingIds: dto.toppingIds },
      requestId,
    );
    return toAdminProductResponseDto(response.product!);
  }

  async setImage(
    id: string,
    file: Express.Multer.File,
    requestId?: string,
  ): Promise<{ imageUrl: string | null }> {
    const response = await this.admin.setImage(
      {
        id,
        content: file.buffer,
        contentType: file.mimetype,
        extension: file.originalname.split('.').pop() ?? '',
      },
      requestId,
    );
    return { imageUrl: response.product!.imageUrl ?? null };
  }

  async clearImage(id: string, requestId?: string): Promise<void> {
    await this.admin.clearImage({ id }, requestId);
  }

  async delete(id: string, ctx: UserContext, requestId?: string): Promise<void> {
    await this.admin.deleteProduct(toCaller(ctx), { id }, requestId);
  }

  async restore(id: string, requestId?: string): Promise<AdminProductResponseDto> {
    const response = await this.admin.restoreProduct({ id }, requestId);
    return toAdminProductResponseDto(response.product!);
  }
}
