import Link from 'next/link';
import type {
  CategoryResponseDto,
  StaffProductResponseDto,
  StaffToppingResponseDto,
} from '@brewlite/api-client';
import { compareStrings } from '@brewlite/contracts';
import { localized } from '@/i18n/format';
import { getLocale, getT } from '@/i18n/server';
import { StaffToppingRow } from './StaffToppingRow';
import { StockRow } from './StockRow';

/**
 * *Products · 30* (grouped by category in menu order; a category with no products hidden) and
 * *Toppings · 7* (by English name). The tab is in `?tab=toppings`, so a reload keeps it; links, so
 * switching is a navigation and nothing is half-saved in a hidden tab.
 */
export async function StockTabs({
  tab,
  products,
  toppings,
  categories,
}: Readonly<{
  tab: 'products' | 'toppings';
  products: StaffProductResponseDto[];
  toppings: StaffToppingResponseDto[];
  categories: CategoryResponseDto[];
}>) {
  const [{ t }, locale] = await Promise.all([getT('staff'), getLocale()]);
  const tabClass = (active: boolean) =>
    `min-h-11 flex-1 rounded-field px-4 text-center font-semibold leading-[2.75rem] ${
      active ? 'bg-primary text-primary-content' : ''
    }`;
  const groups = categories
    .map((category) => ({
      category,
      products: products.filter((p) => p.categoryId === category.id),
    }))
    .filter((group) => group.products.length > 0);
  const byName = [...toppings].sort((a, b) => compareStrings(a.name.en, b.name.en));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <nav aria-label={t('stock.title')} className="bg-base-100 rounded-box flex gap-1 p-1">
        <Link
          href="/staff/products"
          replace
          scroll={false}
          aria-current={tab === 'products' ? 'page' : undefined}
          className={tabClass(tab === 'products')}
        >
          {t('stock.tabs.products', { count: products.length })}
        </Link>
        <Link
          href="/staff/products?tab=toppings"
          replace
          scroll={false}
          aria-current={tab === 'toppings' ? 'page' : undefined}
          className={tabClass(tab === 'toppings')}
        >
          {t('stock.tabs.toppings', { count: toppings.length })}
        </Link>
      </nav>

      {tab === 'products' ? (
        groups.map(({ category, products: rows }) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`} className="mb-2 text-lg font-bold">
              {localized(category.name, locale)}
            </h2>
            <ul className="flex flex-col gap-3">
              {rows.map((product) => (
                <StockRow key={product.id} product={product} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <ul className="flex flex-col gap-3">
          {byName.map((topping) => (
            <StaffToppingRow key={topping.id} topping={topping} />
          ))}
        </ul>
      )}
    </div>
  );
}
