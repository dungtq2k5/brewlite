import { adminReportsControllerSales } from '@brewlite/api-client';
import { businessDay } from '@brewlite/contracts';
import { RangePicker } from '@/components/admin/RangePicker';
import { SalesChart } from '@/components/admin/SalesChart';
import { formatDay, formatVnd, localized } from '@/i18n/format';
import { getT } from '@/i18n/server';
import { firstParam, readOptionalChoice, type RawParams } from '@/lib/admin/list-params';
import { checkRange, resolveRange, type RangePreset } from '@/lib/admin/range';
import { givenName } from '@/lib/admin/greeting';
import { averageOrder, bestDay, totals } from '@/lib/admin/sales';
import { getMe } from '@/lib/me';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('bar.overview') };
}

const PRESETS = ['today', '7d', '30d', 'month', 'custom'] as const;
const dayLabel = (day: string, locale: 'en' | 'vi') => formatDay(`${day}T12:00:00+07:00`, locale);

/** `/admin` (`106:6072`): today's tiles, then a range with its best day, chart, per-day table and top products. */
export default async function OverviewPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const me = await getMe();
  const now = new Date();
  const today = businessDay(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const preset = readOptionalChoice<RangePreset>(raw, 'range', PRESETS) ?? '7d';
  const typed = { from: firstParam(raw, 'from') || today, to: firstParam(raw, 'to') || today };
  const range = resolveRange(preset, today, typed);
  const check = checkRange(range.from, range.to);

  const [todayRes, rangeRes] = await Promise.all([
    adminReportsControllerSales({ from: today, to: today }),
    check.ok ? adminReportsControllerSales(range) : Promise.resolve(null),
  ]).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const todayTotals = totals(todayRes.status === 200 ? (todayRes.data.data?.days ?? []) : []);
  const days = rangeRes?.status === 200 ? (rangeRes.data.data?.days ?? []) : [];
  const top = rangeRes?.status === 200 ? (rangeRes.data.data?.topProducts ?? []) : [];
  const sum = totals(days);
  const best = bestDay(days);
  const avg = averageOrder(todayTotals.revenueVnd, todayTotals.orders);
  const tile = 'bg-base-100 border-base-300 rounded-box flex flex-col gap-1 border p-5';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">
          {t(`sales.greeting.${part}`, { name: givenName(me?.fullName ?? '') })}
        </h1>
        <p className="text-base-content/80">{t('sales.sub')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={tile}>
          <span className="text-base-content/70 text-sm">{t('sales.todayOrders')}</span>
          <span className="text-3xl font-bold tabular-nums">{todayTotals.orders}</span>
        </div>
        <div className={tile}>
          <span className="text-base-content/70 text-sm">{t('sales.todayRevenue')}</span>
          <span className="text-3xl font-bold tabular-nums">
            {formatVnd(todayTotals.revenueVnd, locale)}
          </span>
        </div>
        <div className={tile}>
          <span className="text-base-content/70 text-sm">{t('sales.average')}</span>
          <span className="text-3xl font-bold tabular-nums">
            {avg === null ? '—' : formatVnd(avg, locale)}
          </span>
          <span className="text-base-content/70 text-sm">{t('sales.soFar', { time })}</span>
        </div>
      </div>

      <section aria-labelledby="sales-title" className="flex flex-col gap-4">
        <h2 id="sales-title" className="text-2xl font-bold">
          {t('sales.title')}
        </h2>
        <RangePicker
          path="/admin"
          params={{}}
          presets={PRESETS}
          defaultPreset="7d"
          labels={{
            today: t('sales.today'),
            '7d': t('sales.days7'),
            '30d': t('sales.days30'),
            month: t('sales.month'),
            custom: t('sales.custom'),
          }}
          active={preset}
          custom={range}
          error={
            check.ok
              ? undefined
              : t('sales.tooLong', { count: check.reason === 'tooLong' ? check.days : 0 })
          }
          fromLabel={t('sales.from')}
          toLabel={t('sales.to')}
          applyLabel={t('sales.apply')}
          navLabel={t('sales.rangeNav')}
        />

        {check.ok && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={tile}>
                <span className="text-base-content/70 text-sm">{t('sales.orders')}</span>
                <span className="text-2xl font-bold tabular-nums">{sum.orders}</span>
              </div>
              <div className={tile}>
                <span className="text-base-content/70 text-sm">{t('sales.revenue')}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatVnd(sum.revenueVnd, locale)}
                </span>
              </div>
              <div className={tile}>
                <span className="text-base-content/70 text-sm">{t('sales.bestDay')}</span>
                <span className="text-2xl font-bold">
                  {best ? dayLabel(best.day, locale) : '—'}
                </span>
                {best && (
                  <span className="text-base-content/70 text-sm tabular-nums">
                    {formatVnd(best.revenueVnd, locale)}
                  </span>
                )}
              </div>
            </div>

            <div className="border-base-300 bg-base-100 rounded-box flex flex-col gap-3 border p-6">
              <h3 className="text-lg font-semibold">{t('sales.chart')}</h3>
              <SalesChart days={days} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <table className="border-base-300 rounded-box w-full border text-left">
                <caption className="p-3 text-left text-lg font-semibold">
                  {t('sales.perDay')}
                </caption>
                <thead>
                  <tr className="bg-base-200 text-sm">
                    <th scope="col" className="px-4 py-2">
                      {t('sales.day')}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {t('sales.orders')}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {t('sales.revenue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.day} className="border-base-300 border-t">
                      <td className="px-4 py-2">{dayLabel(d.day, locale)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{d.orders}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatVnd(d.revenueVnd, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="border-base-300 rounded-box h-fit w-full border text-left">
                <caption className="p-3 text-left text-lg font-semibold">{t('sales.top')}</caption>
                <thead>
                  <tr className="bg-base-200 text-sm">
                    <th scope="col" className="px-4 py-2">
                      {t('sales.product')}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {t('sales.qty')}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {t('sales.revenue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top.slice(0, 10).map((p) => (
                    <tr key={p.productId} className="border-base-300 border-t">
                      <td className="px-4 py-2">{localized(p.productName, locale)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.qty}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatVnd(p.revenueVnd, locale)}
                      </td>
                    </tr>
                  ))}
                  {top.length === 0 && (
                    <tr className="border-base-300 border-t">
                      <td colSpan={3} className="px-4 py-3">
                        {t('sales.noSales')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
