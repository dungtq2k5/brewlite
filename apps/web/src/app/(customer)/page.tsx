import { categoriesControllerList, productsControllerList } from '@brewlite/api-client';
import { CategoryNav } from '@/components/menu/CategoryNav';
import { MenuHero } from '@/components/menu/MenuHero';
import { MenuQueryProvider } from '@/components/menu/MenuQuery';
import { MenuSections } from '@/components/menu/MenuSections';
import { getLocale, getT } from '@/i18n/server';
import { localized } from '@/i18n/format';
import { HERO_COOKIE } from '@/lib/cookies';
import { getMe } from '@/lib/me';
import { groupMenu } from '@/lib/menu';
import { heroVariant } from '@/lib/menu-hero';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('menu');
  return { title: t('title') };
}

/**
 * `/` — the whole menu, read on the server in two public calls; a guest and a customer see the same
 * menu. Above it the welcome hero (product-overview §3.1): full for a guest, a strip once signed in, none once dismissed.
 */
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
  const hero = heroVariant(
    (await cookies()).get(HERO_COOKIE)?.value === 'dismissed',
    (await getMe()) !== null,
  );
  const { t } = await getT('menu');
  const allSoldOut =
    sections.length > 0 && sections.every((s) => s.products.every((p) => p.isSoldOut));

  return (
    <MenuQueryProvider>
      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
        <CategoryNav
          sections={sections}
          title={t('title')}
          items={sections.map((s) => ({
            id: s.category.id,
            label: localized(s.category.name, locale),
          }))}
        />
        <div className="mt-4 lg:mt-0">
          {hero && <MenuHero variant={hero} />}
          {allSoldOut && (
            <p role="status" className="bg-base-200 rounded-box mb-4 px-4 py-3">
              {t('allSoldOut')}
            </p>
          )}
          <MenuSections
            sections={sections}
            locale={locale}
            labels={{ from: t('from'), soldOut: t('soldOut') }}
          />
        </div>
      </div>
    </MenuQueryProvider>
  );
}
