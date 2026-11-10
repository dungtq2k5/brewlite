import { adminCategoriesControllerList } from '@brewlite/api-client';
import { CategoriesView } from '@/components/admin/CategoriesView';
import { getT } from '@/i18n/server';
import { countByCategory, allLiveProducts } from '@/lib/admin/server-data';
import { readFlag, type RawParams } from '@/lib/admin/list-params';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('category.title') };
}

/** `/admin/categories` — the menu's order, with each category's live product count. */
export default async function CategoriesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const deleted = readFlag(await searchParams, 'deleted');
  const [res, products] = await Promise.all([
    adminCategoriesControllerList({ deleted: deleted ? 'true' : 'false' }),
    deleted ? Promise.resolve([]) : allLiveProducts(),
  ]).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const categories = res.status === 200 ? (res.data.data ?? []) : [];
  return (
    <CategoriesView
      categories={categories}
      counts={Object.fromEntries(countByCategory(products))}
      deleted={deleted}
    />
  );
}
