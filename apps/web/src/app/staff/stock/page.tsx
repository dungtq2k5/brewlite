import {
  categoriesControllerList,
  productsControllerList,
  staffProductsControllerList,
  staffToppingsControllerList,
  type CategoryResponseDto,
  type ProductSummaryResponseDto,
  type StaffProductResponseDto,
  type StaffToppingResponseDto,
} from '@brewlite/api-client';
import { unwrap } from '@/lib/api-server';
import StockClient from './StockClient';

export const dynamic = 'force-dynamic';

export default async function StaffStockPage() {
  const [productsResult, toppingsResult, categoriesResult, menuResult] = await Promise.allSettled([
    staffProductsControllerList(),
    staffToppingsControllerList(),
    categoriesControllerList(),
    productsControllerList(),
  ]);

  const products =
    productsResult.status === 'fulfilled'
      ? unwrap<StaffProductResponseDto[]>(productsResult.value.data)
      : [];
  const toppings =
    toppingsResult.status === 'fulfilled'
      ? unwrap<StaffToppingResponseDto[]>(toppingsResult.value.data)
      : [];
  const categories =
    categoriesResult.status === 'fulfilled'
      ? unwrap<CategoryResponseDto[]>(categoriesResult.value.data)
      : [];

  const productImages: Record<string, string> = {};
  if (menuResult.status === 'fulfilled') {
    for (const product of unwrap<ProductSummaryResponseDto[]>(menuResult.value.data)) {
      if (product.imageUrl) productImages[product.id] = product.imageUrl;
    }
  }

  return (
    <StockClient
      products={products}
      toppings={toppings}
      categories={categories}
      productImages={productImages}
      productsFailed={productsResult.status === 'rejected'}
      toppingsFailed={toppingsResult.status === 'rejected'}
    />
  );
}
