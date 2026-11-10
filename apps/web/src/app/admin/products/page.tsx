import Link from 'next/link';
import {
  adminCategoriesControllerList,
  adminProductsControllerList,
  AdminProductsControllerListSort,
} from '@brewlite/api-client';
import { AdminTable, Td, Th } from '@/components/admin/AdminTable';
import { FilterBar } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { TableState } from '@/components/admin/TableState';
import { ProductImage } from '@/components/menu/ProductImage';
import { formatVnd, localized } from '@/i18n/format';
import { getT } from '@/i18n/server';
import {
  ADMIN_PAGE_SIZE,
  firstParam,
  readChoice,
  readFlag,
  readPage,
  readSearch,
  type RawParams,
} from '@/lib/admin/list-params';
import { noPhotoVariant } from '@/lib/menu';
import { customerSees } from '@/lib/staff/stock';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('product.title') };
}

const SORTS = Object.values(AdminProductsControllerListSort);

/** `/admin/products` (`98:911`): search, category, Deleted, sort — all in the address. */
export default async function ProductsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const page = readPage(raw);
  const q = readSearch(raw);
  const deleted = readFlag(raw, 'deleted');
  const sort = readChoice(raw, 'sort', SORTS, 'sortOrder');
  const categoryParam = firstParam(raw, 'categoryId');

  const [categoriesRes, productsRes] = await Promise.all([
    adminCategoriesControllerList({}),
    adminProductsControllerList({
      page,
      pageSize: ADMIN_PAGE_SIZE,
      sort,
      deleted: deleted ? 'true' : 'false',
      ...(q ? { q } : {}),
      ...(categoryParam ? { categoryId: categoryParam } : {}),
    }),
  ]).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const categories = categoriesRes.status === 200 ? (categoriesRes.data.data ?? []) : [];
  const rows = productsRes.status === 200 ? (productsRes.data.data ?? []) : [];
  const total = productsRes.status === 200 ? (productsRes.data.meta?.total ?? 0) : 0;
  const position = new Map(categories.map((c, i) => [c.id, i]));
  const categoryId = categories.some((c) => c.id === categoryParam) ? categoryParam : '';
  const current: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(deleted ? { deleted: 'true' } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(sort === 'sortOrder' ? {} : { sort }),
    ...(page > 1 ? { page: String(page) } : {}),
  };
  const filtered = Boolean(q || deleted || categoryId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('product.title')}</h1>
          <p className="text-base-content/80">
            {t('product.count', { products: total, categories: categories.length })}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary min-h-11">
          {t('product.new')}
        </Link>
      </div>

      <FilterBar
        current={current}
        selects={[
          {
            key: 'categoryId',
            label: t('product.categoryLabel'),
            value: categoryId,
            options: [
              { value: '', label: t('product.categoryAll') },
              ...categories.map((c) => ({
                value: c.id,
                label: t('product.categoryIs', { name: localized(c.name, locale) }),
              })),
            ],
          },
        ]}
        sort={{
          value: sort,
          options: SORTS.map((value) => ({ value, label: t(`product.sort.${value}`) })),
        }}
      />

      {rows.length === 0 ? (
        <TableState
          filtered={filtered}
          none={deleted ? t('product.noneDeleted') : t('product.none')}
          action={
            !filtered && (
              <Link href="/admin/products/new" className="btn btn-primary min-h-11">
                {t('product.new')}
              </Link>
            )
          }
        />
      ) : (
        <>
          <AdminTable caption={t('product.title')}>
            <thead>
              <tr>
                <Th>{t('product.cols.name')}</Th>
                <Th className="hidden min-[1280px]:table-cell">{t('product.cols.category')}</Th>
                <Th className="text-right">{t('product.cols.price')}</Th>
                <Th>{t('product.cols.sees')}</Th>
                <Th>
                  <span className="sr-only">{t('action.edit')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const name = localized(p.name, locale);
                const sees = customerSees(p.isAvailable, p.stockQty);
                return (
                  <tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="bg-base-200 size-12 shrink-0 overflow-hidden rounded-lg">
                          <ProductImage
                            imageUrl={p.imageUrl}
                            name=""
                            variant={noPhotoVariant(position.get(p.categoryId) ?? 0)}
                            iconSize={20}
                          />
                        </div>
                        <Link href={`/admin/products/${p.id}`} className="font-semibold underline">
                          {name}
                        </Link>
                      </div>
                    </Td>
                    <Td className="hidden min-[1280px]:table-cell">
                      {localized(p.categoryName, locale)}
                    </Td>
                    <Td className="text-right tabular-nums">{formatVnd(p.basePriceVnd, locale)}</Td>
                    <Td>
                      {deleted ? (
                        <span className="bg-base-200 rounded-full px-3 py-1 text-sm font-semibold">
                          {t('status.deleted')}
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            sees === 'onSale' ? 'bg-success/15' : 'bg-base-200'
                          }`}
                        >
                          {t(`sees.${sees}`)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline"
                      >
                        {t('action.edit')}
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
          <Pagination
            path="/admin/products"
            current={current}
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
          />
        </>
      )}
    </div>
  );
}
