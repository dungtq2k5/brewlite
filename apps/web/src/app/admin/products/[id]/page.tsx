import { notFound } from 'next/navigation';
import {
  adminCategoriesControllerList,
  adminProductsControllerGet,
  adminToppingsControllerList,
  type AdminCategoryResponseDto,
  type AdminProductResponseDto,
  type AdminToppingResponseDto,
} from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockProduct } from '@/mocks/admin-data';
import { ProductEditor } from './product-editor';

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireServerAuth();

  try {
    const [prodRes, catActive, catDeleted, topActive, topDeleted] = await Promise.all([
      adminProductsControllerGet(id),
      adminCategoriesControllerList({ deleted: 'false' }),
      adminCategoriesControllerList({ deleted: 'true' }),
      adminToppingsControllerList({ deleted: 'false' }),
      adminToppingsControllerList({ deleted: 'true' }),
    ]);

    const prodDto = (prodRes.data as unknown as { data?: AdminProductResponseDto })?.data;
    if (!prodDto) {
      notFound();
    }

    const catDtos = [
      ...((catActive.data as unknown as { data?: AdminCategoryResponseDto[] })?.data ?? []),
      ...((catDeleted.data as unknown as { data?: AdminCategoryResponseDto[] })?.data ?? []),
    ];
    const topDtos = [
      ...((topActive.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? []),
      ...((topDeleted.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? []),
    ];

    const mappedProduct: MockProduct = {
      id: prodDto.id,
      categoryId: prodDto.categoryId,
      name: prodDto.name,
      description: prodDto.description ?? { vi: '', en: '' },
      basePriceVnd: prodDto.basePriceVnd,
      sortOrder: prodDto.sortOrder,
      imageUrl: unwrapNullable(prodDto.imageUrl),
      isAvailable: prodDto.isAvailable,
      stockQty: prodDto.stockQty,
      version: prodDto.version,
      sizes: prodDto.sizes.map((s) => ({
        size: s.size as 'S' | 'M' | 'L',
        priceDeltaVnd: s.priceDeltaVnd ?? 0,
      })),
      toppingIds: prodDto.toppingIds,
      createdAt: prodDto.createdAt,
      deletedAt: unwrapNullable(prodDto.deletedAt),
    };

    return (
      <ProductEditor
        initialProduct={mappedProduct}
        categories={catDtos.map((c) => ({
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          deletedAt: unwrapNullable(c.deletedAt),
          createdAt: c.createdAt,
        }))}
        allToppings={topDtos.map((t) => ({
          id: t.id,
          name: t.name,
          priceVnd: t.priceVnd,
          isAvailable: t.isAvailable,
          deletedAt: unwrapNullable(t.deletedAt),
          createdAt: t.createdAt,
        }))}
      />
    );
  } catch (err) {
    handlePageApiError(err);
  }
}