'use client';

import { SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { noPhotoVariant, type MenuSection } from '@/lib/menu';
import { matches } from '@/lib/menu-search';
import { useMenuQuery } from './MenuQuery';
import { MenuSearch } from './MenuSearch';
import { ProductCard, type ProductCardLabels } from './ProductCard';

/** The sections that hold a match, each with only its matching products (all of them for no query). */
export function useFilteredSections(sections: readonly MenuSection[]): MenuSection[] {
  const { query } = useMenuQuery();
  return useMemo(
    () =>
      query.trim() === ''
        ? [...sections]
        : sections.flatMap((s) => {
            const products = s.products.filter((p) => matches(p, query));
            return products.length > 0 ? [{ ...s, products }] : [];
          }),
    [sections, query],
  );
}

/**
 * The menu's sections, from the server's `groupMenu()` — rendered on the server for the first load
 * (a client component is still server-rendered), filtered on the device while a search is typed:
 * matching cards only, grouped by category, empty categories hidden. No call to the API.
 */
export function MenuSections({
  sections,
  locale,
  labels,
}: Readonly<{ sections: MenuSection[]; locale: Locale; labels: ProductCardLabels }>) {
  const { t } = useTranslation('menu');
  const { query, setQuery } = useMenuQuery();
  const shown = useFilteredSections(sections);
  const count = shown.reduce((sum, s) => sum + s.products.length, 0);
  const searching = query.trim() !== '';

  // Clearing a search returns to the full menu, at the top.
  const wasSearching = useRef(false);
  useEffect(() => {
    if (wasSearching.current && !searching) window.scrollTo({ top: 0 });
    wasSearching.current = searching;
  }, [searching]);

  return (
    <>
      <MenuSearch count={count} className="mb-4 lg:hidden" />
      {searching && count === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <span className="bg-base-200 grid size-16 place-items-center rounded-full">
            <SearchX aria-hidden size={28} />
          </span>
          <p className="text-lg font-semibold">{t('search.none', { q: query.trim() })}</p>
          <p className="text-base-content/70">{t('search.hint')}</p>
          <button type="button" className="btn btn-outline min-h-11" onClick={() => setQuery('')}>
            {t('search.clear')}
          </button>
        </div>
      ) : (
        shown.map((section) => (
          <section key={section.category.id} id={`cat-${section.category.id}`} className="mb-8">
            <h2
              id={`cat-heading-${section.category.id}`}
              className="mb-3 scroll-mt-[calc(var(--bl-header-h,3.5rem)+var(--bl-nav-h,3.75rem)+0.75rem)] text-2xl font-bold lg:scroll-mt-[calc(var(--bl-header-h,3.5rem)+1.5rem)]"
            >
              {localized(section.category.name, locale)}
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
              {section.products.map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    variant={noPhotoVariant(section.position)}
                    locale={locale}
                    labels={labels}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
