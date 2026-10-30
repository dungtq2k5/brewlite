import { categoriesControllerList, productsControllerList } from '@brewlite/api-client';
import { CategoryNav } from '@/components/menu/CategoryNav';
import { ProductCard } from '@/components/menu/ProductCard';
import { getLocale, getT } from '@/i18n/server';
import { localized } from '@/i18n/format';
import { groupMenu, noPhotoVariant } from '@/lib/menu';

export async function generateMetadata() {
  const { t } = await getT('menu');
  return { title: t('title') };
}

/** `/` — the whole menu, read on the server in two public calls; a guest and a customer see the same page. */
export default async function MenuPage() {
  const [categories, products] = await Promise.all([
    categoriesControllerList(),
    productsControllerList(),
  ]);
  const sections = groupMenu(
    categories.status === 200 ? (categories.data.data ?? []) : [],
    products.status === 200 ? (products.data.data ?? []) : [],
  );
  const locale = await getLocale();
  const { t } = await getT('menu');
  const allSoldOut =
    sections.length > 0 && sections.every((s) => s.products.every((p) => p.isSoldOut));

  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
      <CategoryNav
        title={t('title')}
        items={sections.map((s) => ({
          id: s.category.id,
          label: localized(s.category.name, locale),
        }))}
      />
      <div className="mt-4 lg:mt-0">
        {allSoldOut && (
          <p role="status" className="bg-base-200 rounded-box mb-4 px-4 py-3">
            {t('allSoldOut')}
          </p>
        )}
        {sections.map((section) => (
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
                    labels={{ from: t('from'), soldOut: t('soldOut') }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
