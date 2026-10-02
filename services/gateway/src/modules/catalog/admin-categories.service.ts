import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { CatalogAdminGrpcClient } from './catalog-admin-grpc.client.js';
import { toAdminCategoryResponseDto } from './admin-category.mapper.js';
import type { AdminCategoryResponseDto } from './dto/admin-category.dto.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-category.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly admin: CatalogAdminGrpcClient) {}

  async list(
    deleted: boolean | undefined,
    requestId?: string,
  ): Promise<AdminCategoryResponseDto[]> {
    const response = await this.admin.listCategories({ deleted }, requestId);
    return response.categories.map(toAdminCategoryResponseDto);
  }

  async create(dto: CreateCategoryDto, requestId?: string): Promise<AdminCategoryResponseDto> {
    const response = await this.admin.createCategory(
      { name: dto.name, sortOrder: dto.sortOrder, isActive: dto.isActive },
      requestId,
    );
    return toAdminCategoryResponseDto(response.category!);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    requestId?: string,
  ): Promise<AdminCategoryResponseDto> {
    const response = await this.admin.updateCategory(
      { id, name: dto.name, sortOrder: dto.sortOrder, isActive: dto.isActive },
      requestId,
    );
    return toAdminCategoryResponseDto(response.category!);
  }

  async delete(id: string, ctx: UserContext, requestId?: string): Promise<void> {
    await this.admin.deleteCategory(toCaller(ctx), { id }, requestId);
  }

  async restore(id: string, requestId?: string): Promise<AdminCategoryResponseDto> {
    const response = await this.admin.restoreCategory({ id }, requestId);
    return toAdminCategoryResponseDto(response.category!);
  }
}
