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
import { Info } from 'lucide-react';
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
      <div className="lg:grid lg:grid-cols-[12.5rem_1fr] lg:gap-6 lg:pt-7">
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
            <div
              role="status"
              className="bg-info text-info-content rounded-box mb-7 flex items-start gap-3 px-4 py-3.5"
            >
              <Info aria-hidden size={22} className="shrink-0" />
              <p className="flex-1 text-[15px] leading-5.5 font-medium">{t('allSoldOut')}</p>
            </div>
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
