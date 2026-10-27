import {
  adminToppingsControllerList,
  categoriesControllerList,
  productsControllerList,
  staffProductsControllerList,
  type AdminToppingResponseDto,
  type CategoryResponseDto,
  type ProductSummaryResponseDto,
  type StaffProductResponseDto,
} from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import {
  InventoryClient,
  type InventoryCategory,
  type InventoryProduct,
  type InventoryTopping,
} from './inventory-client';

export default async function StaffInventoryPage() {
  await requireServerAuth();
  try {
    const [prodRes, topRes, catRes, pubProdRes] = await Promise.all([
      staffProductsControllerList(),
      adminToppingsControllerList({ deleted: 'false' }).catch(() => ({ data: { data: [] } })),
      categoriesControllerList().catch(() => ({ data: { data: [] } })),
      productsControllerList({}).catch(() => ({ data: { data: [] } })),
    ]);

    const prodDtos = (prodRes.data as unknown as { data?: StaffProductResponseDto[] })?.data ?? [];
    const topDtos = (topRes.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? [];
    const catDtos = (catRes.data as unknown as { data?: CategoryResponseDto[] })?.data ?? [];
    const pubProdDtos = (pubProdRes.data as unknown as { data?: ProductSummaryResponseDto[] })?.data ?? [];

    const categoryMap = new Map<string, string>();
    const categories: InventoryCategory[] = [];
    for (const c of catDtos) {
      const nameVi = c.name?.vi || c.name?.en || 'Chưa phân loại';
      categoryMap.set(c.id, nameVi);
      categories.push({
        id: c.id,
        name: { vi: c.name?.vi || '', en: c.name?.en || '' },
      });
    }

    const pubProductMap = new Map<string, { priceVnd: number; imageUrl: string | null }>();
    for (const p of pubProdDtos) {
      const firstImage = Array.isArray(p.imageUrl) ? p.imageUrl[0] : (typeof p.imageUrl === 'string' ? p.imageUrl : null);
      pubProductMap.set(p.id, {
        priceVnd: p.fromPriceVnd ?? 0,
        imageUrl: firstImage ?? null,
      });
    }

    const mappedProducts: InventoryProduct[] = prodDtos.map((p) => {
      const pubInfo = pubProductMap.get(p.id);
      return {
        id: p.id,
        categoryId: p.categoryId,
        categoryName: categoryMap.get(p.categoryId) ?? 'Chưa phân loại',
        name: { vi: p.name?.vi || '', en: p.name?.en || '' },
        priceVnd: pubInfo?.priceVnd ?? 0,
        imageUrl: pubInfo?.imageUrl ?? null,
        isAvailable: p.isAvailable,
        stockQty: p.stockQty,
        version: p.version,
      };
    });


    const mappedToppings: InventoryTopping[] = topDtos.map((t) => ({
      id: t.id,
      name: { vi: t.name?.vi || '', en: t.name?.en || '' },
      priceVnd: t.priceVnd,
      isAvailable: t.isAvailable,
    }));

    return (
      <InventoryClient
        initialProducts={mappedProducts}
        initialToppings={mappedToppings}
        categories={categories}
      />
    );
  } catch (err) {
    handlePageApiError(err);
  }
}