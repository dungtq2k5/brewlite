import Link from 'next/link';
import { promotionsControllerList, PromotionsControllerListSort } from '@brewlite/api-client';
import { AdminTable, Td, Th } from '@/components/admin/AdminTable';
import { FilterBar } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { PromotionBadge } from '@/components/admin/PromotionBadge';
import { PromotionRowActions } from '@/components/admin/PromotionRowActions';
import { TableState } from '@/components/admin/TableState';
import { formatDay, formatVnd } from '@/i18n/format';
import { getT } from '@/i18n/server';
import { discountWords } from '@/lib/admin/discount-words';
import {
  ADMIN_PAGE_SIZE,
  readChoice,
  readFlag,
  readPage,
  readSearch,
  type RawParams,
} from '@/lib/admin/list-params';
import { promotionState } from '@/lib/admin/promotion-state';
import { withRequestId } from '@/lib/with-request-id';
import { mono } from './mono';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('promo.title') };
}

const SORTS = Object.values(PromotionsControllerListSort);

/** `/admin/promotions` (`102:3328`): codes in monospace, the discount in words, the window in Vietnam time. */
export default async function PromotionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const page = readPage(raw);
  const q = readSearch(raw);
  const deleted = readFlag(raw, 'deleted');
  const activeOnly = readFlag(raw, 'active');
  const sort = readChoice(raw, 'sort', SORTS, '-createdAt');

  const res = await promotionsControllerList({
    page,
    pageSize: ADMIN_PAGE_SIZE,
    sort,
    deleted: deleted ? 'true' : 'false',
    ...(activeOnly ? { active: 'true' as const } : {}),
    ...(q ? { q } : {}),
  }).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const rows = res.status === 200 ? (res.data.data ?? []) : [];
  const total = res.status === 200 ? (res.data.meta?.total ?? 0) : 0;
  const now = new Date();
  const current: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(deleted ? { deleted: 'true' } : {}),
    ...(activeOnly ? { active: 'true' } : {}),
    ...(sort === '-createdAt' ? {} : { sort }),
    ...(page > 1 ? { page: String(page) } : {}),
  };
  const filtered = Boolean(q || deleted || activeOnly);
  const newLink = (
    <Link href="/admin/promotions/new" className="btn btn-primary min-h-11">
      {t('promo.new')}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('promo.title')}</h1>
          <p className="text-base-content/80">{t('promo.intro')}</p>
        </div>
        {newLink}
      </div>
      <FilterBar
        current={current}
        defaults={{ sort: '-createdAt' }}
        search
        searchLabel={t('promo.search')}
        toggles={[{ key: 'active', label: t('promo.activeOnly'), on: activeOnly }]}
        sort={{
          value: sort,
          options: SORTS.map((value) => ({ value, label: t(`promo.sortBy.${value}`) })),
        }}
      />
      {rows.length === 0 ? (
        <TableState
          filtered={filtered}
          none={deleted ? t('promo.noneDeleted') : `${t('promo.none')} ${t('promo.noneHint')}`}
          action={!filtered && newLink}
        />
      ) : (
        <>
          <AdminTable caption={t('promo.title')}>
            <thead>
              <tr>
                <Th>{t('promo.cols.code')}</Th>
                <Th>{t('promo.cols.discount')}</Th>
                <Th>{t('promo.cols.window')}</Th>
                <Th>{t('promo.cols.uses')}</Th>
                <Th>{t('promo.cols.state')}</Th>
                <Th>
                  <span className="sr-only">{t('action.edit')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/admin/promotions/${p.id}`}
                      className={`${mono.className} font-semibold underline`}
                    >
                      {p.code}
                    </Link>
                  </Td>
                  <Td>
                    {discountWords(t, locale, p)}
                    {p.minSubtotalVnd > 0 && (
                      <span className="text-base-content/70 block text-sm">
                        {t('promo.min', { amount: formatVnd(p.minSubtotalVnd, locale) })}
                      </span>
                    )}
                  </Td>
                  <Td className="text-sm whitespace-nowrap">
                    {formatDay(p.startsAt, locale, true)} → {formatDay(p.endsAt, locale, true)}
                  </Td>
                  <Td className="tabular-nums">
                    {p.maxUses === null
                      ? t('promo.usedUnlimited', { used: p.usedCount })
                      : t('promo.used', { used: p.usedCount, max: p.maxUses })}
                  </Td>
                  <Td>
                    {deleted ? (
                      <span className="bg-base-200 rounded-full px-3 py-1 text-sm font-semibold">
                        {t('status.deleted')}
                      </span>
                    ) : (
                      <PromotionBadge state={promotionState(p, now)} />
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <PromotionRowActions id={p.id} deleted={deleted} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <Pagination
            path="/admin/promotions"
            current={current}
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
            defaults={{ sort: '-createdAt' }}
          />
        </>
      )}
    </div>
  );
}
