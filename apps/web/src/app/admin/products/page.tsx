import {
  adminCategoriesControllerList,
  adminProductsControllerList,
  type AdminCategoryResponseDto,
  type AdminProductListItemResponseDto,
} from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockCategory, MockProduct } from '@/mocks/admin-data';
import { ProductsClient } from './products-client';

function mapCat(dto: AdminCategoryResponseDto): MockCategory {
  return {
    id: dto.id,
    name: dto.name,
    sortOrder: dto.sortOrder,
    isActive: dto.isActive,
    deletedAt: unwrapNullable(dto.deletedAt),
    createdAt: dto.createdAt,
  };
}

function mapProd(dto: AdminProductListItemResponseDto): MockProduct {
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    name: dto.name,
    description: { vi: '', en: '' },
    basePriceVnd: dto.basePriceVnd,
    sortOrder: dto.sortOrder,
    imageUrl: unwrapNullable(dto.imageUrl),
    isAvailable: dto.isAvailable,
    stockQty: dto.stockQty,
    version: dto.version,
    sizes: [{ size: 'M', priceDeltaVnd: 0 }],
    toppingIds: [],
    createdAt: dto.createdAt,
    deletedAt: unwrapNullable(dto.deletedAt),
  };
}

export default async function AdminProductsPage() {
  await requireServerAuth();
  try {
    const [prodActive, prodDeleted, catActive, catDeleted] = await Promise.all([
      adminProductsControllerList({ deleted: 'false' }),
      adminProductsControllerList({ deleted: 'true' }),
      adminCategoriesControllerList({ deleted: 'false' }),
      adminCategoriesControllerList({ deleted: 'true' }),
    ]);

    const products = [
      ...((prodActive.data as unknown as { data?: AdminProductListItemResponseDto[] })?.data ?? []),
      ...((prodDeleted.data as unknown as { data?: AdminProductListItemResponseDto[] })?.data ?? []),
    ].map(mapProd);

    const categories = [
      ...((catActive.data as unknown as { data?: AdminCategoryResponseDto[] })?.data ?? []),
      ...((catDeleted.data as unknown as { data?: AdminCategoryResponseDto[] })?.data ?? []),
    ].map(mapCat);

    return <ProductsClient initialProducts={products} categories={categories} />;
  } catch (err) {
    handlePageApiError(err);
  }
}