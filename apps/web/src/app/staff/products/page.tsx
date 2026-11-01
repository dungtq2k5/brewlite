import {
  categoriesControllerList,
  staffProductsControllerList,
  staffToppingsControllerList,
} from '@brewlite/api-client';
import { StockTabs } from '@/components/staff/StockTabs';
import { getT } from '@/i18n/server';
import { withRequestId } from '@/lib/with-request-id';

export async function generateMetadata() {
  const { t } = await getT('staff');
  return { title: t('stock.title') };
}

/** `/staff/products` — what is on sale, why not, and the counted stock; products and toppings. */
export default async function StaffStockPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ tab?: string | string[] }> }>) {
  const [query, products, toppings, categories] = await Promise.all([
    searchParams,
    staffProductsControllerList(),
    staffToppingsControllerList(),
    // Only the menu's category order and names: losing them is not worth failing the page.
    categoriesControllerList().catch(() => null),
  ]).catch((error: unknown) => {
    throw withRequestId(error);
  });
  return (
    <StockTabs
      tab={query.tab === 'toppings' ? 'toppings' : 'products'}
      products={products.status === 200 ? (products.data.data ?? []) : []}
      toppings={toppings.status === 200 ? (toppings.data.data ?? []) : []}
      categories={categories?.status === 200 ? (categories.data.data ?? []) : []}
    />
  );
}
