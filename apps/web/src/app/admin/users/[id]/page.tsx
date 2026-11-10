import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  adminOrdersControllerList,
  adminUserActivityControllerLoyalty,
  adminUserActivityControllerStaffStats,
  adminUsersControllerGet,
  ApiClientError,
} from '@brewlite/api-client';
import { businessDay } from '@brewlite/contracts';
import { RangePicker } from '@/components/admin/RangePicker';
import { RoleBadge, UserStatusBadge } from '@/components/admin/UserBadges';
import { UserAccess } from '@/components/admin/UserAccess';
import { CounterTiles, UserOrders, UserPoints } from '@/components/admin/UserActivity';
import { formatDay } from '@/i18n/format';
import { getT } from '@/i18n/server';
import { firstParam, readOptionalChoice, type RawParams } from '@/lib/admin/list-params';
import { checkRange, resolveRange, type RangePreset } from '@/lib/admin/range';
import { userStatus } from '@/lib/admin/user-status';
import { getMe } from '@/lib/me';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('users.title') };
}

const PRESETS = ['thisWeek', 'lastWeek', 'thisMonth', 'custom'] as const;

/** `/admin/users/[id]` (`104:4300` …): who they are, *Access*, then points + orders or counter activity. */
export default async function UserPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<RawParams> }>) {
  const { id } = await params;
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const [me, userRes] = await Promise.all([
    getMe(),
    adminUsersControllerGet(id).catch((error: unknown) => {
      if (error instanceof ApiClientError && (error.status === 404 || error.status === 400))
        notFound();
      throw withRequestId(error);
    }),
  ]);
  const user = userRes.status === 200 ? userRes.data.data : undefined;
  if (!user) notFound();
  const now = new Date();
  const status = userStatus(user, now);
  const isCustomer = user.role === 'CUSTOMER';

  let body: React.ReactNode;
  if (isCustomer) {
    const [loyalty, orders] = await Promise.all([
      adminUserActivityControllerLoyalty(id),
      adminOrdersControllerList({ userId: id, pageSize: 3 }),
    ]).catch((error: unknown) => {
      throw withRequestId(error);
    });
    body = (
      <>
        {loyalty.status === 200 && loyalty.data.data && <UserPoints loyalty={loyalty.data.data} />}
        <UserOrders orders={orders.status === 200 ? (orders.data.data ?? []) : []} userId={id} />
      </>
    );
  } else {
    const today = businessDay(now);
    const preset = readOptionalChoice<RangePreset>(raw, 'range', PRESETS) ?? 'thisWeek';
    const typed = { from: firstParam(raw, 'from') || today, to: firstParam(raw, 'to') || today };
    const range = resolveRange(preset, today, typed);
    const check = checkRange(range.from, range.to);
    const stats = check.ok
      ? await adminUserActivityControllerStaffStats(id, range).catch((error: unknown) => {
          throw withRequestId(error);
        })
      : null;
    body = (
      <section
        aria-labelledby="counter-title"
        className="border-base-300 bg-base-100 rounded-box flex flex-col gap-4 border p-6"
      >
        <h2 id="counter-title" className="text-xl font-semibold">
          {t('users.detail.counter')}
        </h2>
        <RangePicker
          path={`/admin/users/${id}`}
          params={{}}
          presets={PRESETS}
          defaultPreset="thisWeek"
          labels={{
            thisWeek: t('users.detail.thisWeek'),
            lastWeek: t('users.detail.lastWeek'),
            thisMonth: t('users.detail.thisMonth'),
            custom: t('users.detail.custom'),
          }}
          active={preset}
          custom={range}
          error={
            check.ok
              ? undefined
              : t('sales.tooLong', { count: check.reason === 'tooLong' ? check.days : 0 })
          }
          fromLabel={t('users.detail.from')}
          toLabel={t('users.detail.to')}
          applyLabel={t('sales.apply')}
          navLabel={t('sales.rangeNav')}
        />
        {stats?.status === 200 && stats.data.data && <CounterTiles stats={stats.data.data} />}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/users" className="min-h-11 text-sm font-medium underline">
        ‹ {t('users.back')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{user.fullName}</h1>
        <RoleBadge role={user.role} />
        <UserStatusBadge status={status} />
      </div>
      <p className="text-base-content/80">
        {user.email} · {t('users.since', { day: formatDay(user.createdAt, locale, true) })}
      </p>
      <UserAccess user={user} status={status} isSelf={me?.id === user.id} />
      {body}
    </div>
  );
}
