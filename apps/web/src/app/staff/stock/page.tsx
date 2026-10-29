import {
  categoriesControllerList,
  staffProductsControllerList,
  staffToppingsControllerList,
  type CategoryResponseDto,
  type StaffProductResponseDto,
  type StaffToppingResponseDto,
} from '@brewlite/api-client';
import { unwrap } from '@/lib/api-server';
import StockClient from './StockClient';

export const dynamic = 'force-dynamic';

export default async function StaffStockPage() {
  const [productsResult, toppingsResult, categoriesResult] = await Promise.allSettled([
    staffProductsControllerList(),
    staffToppingsControllerList(),
    categoriesControllerList(),
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

  return (
    <StockClient
      products={products}
      toppings={toppings}
      categories={categories}
      productsFailed={productsResult.status === 'rejected'}
      toppingsFailed={toppingsResult.status === 'rejected'}
    />
  );
}
