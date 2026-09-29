import { Injectable } from '@nestjs/common';
import { Locale, MAX_MENU_CATEGORIES, newId } from '@brewlite/contracts';
import {
  isUniqueConstraintViolation,
  requireUser,
  rpcError,
  type Caller,
} from '@brewlite/nest-common';
import type {
  CreateCategoryRequest,
  CreateCategoryResponse,
  DeleteCategoryRequest,
  DeleteCategoryResponse,
  AdminMenuServiceListCategoriesRequest,
  AdminMenuServiceListCategoriesResponse,
  RestoreCategoryRequest,
  RestoreCategoryResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MenuCache } from '../menu/menu-cache.service.js';
import {
  ADMIN_CATEGORY_SELECT,
  toProtoAdminCategory,
  type AdminCategoryRow,
} from './admin-category.mapper.js';
import { lockCategory } from './domain/lock-category.js';

function throwIfNameTaken(error: unknown): void {
  if (isUniqueConstraintViolation(error, 'categories_name_en_live_key')) {
    throw rpcError('CATEGORY_NAME_TAKEN', { locale: Locale.EN });
  }
  if (isUniqueConstraintViolation(error, 'categories_name_vi_live_key')) {
    throw rpcError('CATEGORY_NAME_TAKEN', { locale: Locale.VI });
  }
}

@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MenuCache,
  ) {}

  async listCategories(
    request: AdminMenuServiceListCategoriesRequest,
  ): Promise<AdminMenuServiceListCategoriesResponse> {
    const rows = await this.prisma.category.findMany({
      where: request.deleted === true ? { deletedAt: { not: null } } : { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: MAX_MENU_CATEGORIES,
      select: ADMIN_CATEGORY_SELECT,
    });
    return { categories: rows.map(toProtoAdminCategory) };
  }

  async createCategory(request: CreateCategoryRequest): Promise<CreateCategoryResponse> {
    let created;
    try {
      created = await this.prisma.category.create({
        data: {
          id: newId(),
          nameEn: request.name!.en,
          nameVi: request.name!.vi,
          sortOrder: request.sortOrder ?? 0,
          isActive: request.isActive ?? true,
        },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { category: toProtoAdminCategory(await this.findByIdIncludingDeleted(created.id)) };
  }

  async updateCategory(request: UpdateCategoryRequest): Promise<UpdateCategoryResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    try {
      await this.prisma.category.update({
        where: { id: request.id },
        data: {
          ...(request.name !== undefined && { nameEn: request.name.en, nameVi: request.name.vi }),
          ...(request.sortOrder !== undefined && { sortOrder: request.sortOrder }),
          ...(request.isActive !== undefined && { isActive: request.isActive }),
        },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { category: toProtoAdminCategory(await this.findByIdIncludingDeleted(request.id)) };
  }

  async deleteCategory(
    request: DeleteCategoryRequest,
    caller: Caller,
  ): Promise<DeleteCategoryResponse> {
    const { userId: actorId } = requireUser(caller);
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt !== null) throw rpcError('INVALID_STATE', { status: 'DELETED' });

    await this.prisma.$transaction(async (tx) => {
      const stillLive = await lockCategory(tx, request.id, 'UPDATE');
      if (!stillLive) throw rpcError('INVALID_STATE', { status: 'DELETED' });
      const liveProducts = await tx.product.count({
        where: { categoryId: request.id, deletedAt: null },
      });
      if (liveProducts > 0) throw rpcError('CATEGORY_IN_USE');
      await tx.category.update({
        where: { id: request.id },
        data: { deletedAt: new Date(), deletedById: actorId },
      });
    });
    await this.cache.invalidate();
    return { category: toProtoAdminCategory(await this.findByIdIncludingDeleted(request.id)) };
  }

  async restoreCategory(request: RestoreCategoryRequest): Promise<RestoreCategoryResponse> {
    const target = await this.findByIdIncludingDeleted(request.id);
    if (target.deletedAt === null) throw rpcError('INVALID_STATE', { status: 'ACTIVE' });

    try {
      await this.prisma.category.update({
        where: { id: request.id },
        data: { deletedAt: null, deletedById: null },
      });
    } catch (error) {
      throwIfNameTaken(error);
      throw error;
    }
    await this.cache.invalidate();
    return { category: toProtoAdminCategory(await this.findByIdIncludingDeleted(request.id)) };
  }

  private async findByIdIncludingDeleted(id: string): Promise<AdminCategoryRow> {
    const row = await this.prisma.category.findFirst({
      where: { id },
      select: ADMIN_CATEGORY_SELECT,
    });
    if (!row) throw rpcError('RESOURCE_NOT_FOUND', { resource: 'CATEGORY' });
    return row;
  }
}
