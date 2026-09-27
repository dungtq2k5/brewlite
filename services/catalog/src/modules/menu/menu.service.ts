import { Injectable } from '@nestjs/common';
import { MAX_MENU_CATEGORIES } from '@brewlite/contracts';
import { live } from '@brewlite/nest-common';
import type {
  ListCategoriesRequest,
  ListCategoriesResponse,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CATEGORY_MENU_SELECT, toProtoCategory } from './category.mapper.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(_request: ListCategoriesRequest): Promise<ListCategoriesResponse> {
    const rows = await this.prisma.category.findMany({
      where: { ...live, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: MAX_MENU_CATEGORIES,
      select: CATEGORY_MENU_SELECT,
    });
    return { categories: rows.map(toProtoCategory) };
  }
}
