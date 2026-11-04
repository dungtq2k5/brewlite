import Link from 'next/link';
import { adminReportsControllerSales, type SalesReportResponseDto } from '@brewlite/api-client';
import { businessDay, businessDayCount, isBusinessDay, REPORT_MAX_DAYS } from '@brewlite/contracts';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { consoleCopy } from '@/i18n/console';
import { formatVnd, localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { formatDay } from '@/lib/admin-format';
import { unwrap } from '@/lib/api-server';

const DAY_MS = 24 * 60 * 60_000;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}) {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);
  const params = await searchParams;

  const today = businessDay(new Date());
  const defaultFrom = shiftDay(today, -6);
  const rawFrom = first(params.from).trim();
  const rawTo = first(params.to).trim();
  const from = isBusinessDay(rawFrom) ? rawFrom : defaultFrom;
  const to = isBusinessDay(rawTo) ? rawTo : today;

  let rangeError: string | null = null;
  if (from > to) {
    rangeError = t(
      'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
      'The start date must be on or before the end date.',
    );
  } else if (businessDayCount(from, to) > REPORT_MAX_DAYS) {
    rangeError = t(
      `Mỗi lần xem tối đa ${REPORT_MAX_DAYS} ngày.`,
      `A report covers at most ${REPORT_MAX_DAYS} days.`,
    );
  }

  let report: SalesReportResponseDto | null = null;
  let failed = false;
  if (!rangeError) {
    try {
      const response = await adminReportsControllerSales({ from, to });
      report = unwrap<SalesReportResponseDto>(response.data);
    } catch {
      failed = true;
    }
  }

  const days = report?.days ?? [];
  const topProducts = report?.topProducts ?? [];
  const totalRevenue = days.reduce((sum, day) => sum + day.revenueVnd, 0);
  const totalOrders = days.reduce((sum, day) => sum + day.orders, 0);
  const daysWithSales = days.filter((day) => day.orders > 0).length;
  const averageOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const bestSeller = topProducts[0];

  return (
    <>
      <PageHead
        title={t('Báo cáo', 'Reports')}
        meta={t(
          `Doanh thu theo ngày · ${formatDay(from, locale)} – ${formatDay(to, locale)}`,
          `Daily revenue · ${formatDay(from, locale)} – ${formatDay(to, locale)}`,
        )}
        actions={
          <ButtonLinkRange from={shiftDay(today, -6)} to={today} label={t('7 ngày', '7 days')} />
        }
      />

      <Panel>
        <form className="toolbar" action="/admin/reports" method="get">
          <div className="field">
            <label htmlFor="report-from">{t('Từ ngày', 'From')}</label>
            <input
              id="report-from"
              className="input"
              name="from"
              type="date"
              defaultValue={from}
              max={today}
            />
          </div>
          <div className="field">
            <label htmlFor="report-to">{t('Đến ngày', 'To')}</label>
            <input
              id="report-to"
              className="input"
              name="to"
              type="date"
              defaultValue={to}
              max={today}
            />
          </div>
          <Button type="submit">{t('Xem báo cáo', 'Run report')}</Button>
          <Link
            className="btn btn--quiet btn--sm"
            href={`/admin/reports?from=${today}&to=${today}`}
          >
            {t('Hôm nay', 'Today')}
          </Link>
          <Link
            className="btn btn--quiet btn--sm"
            href={`/admin/reports?from=${shiftDay(today, -29)}&to=${today}`}
          >
            {t('30 ngày', '30 days')}
          </Link>
        </form>

        {rangeError && (
          <div className="panel-body">
            <Notice tone="warning" role="alert">
              {rangeError}
            </Notice>
          </div>
        )}
        {!rangeError && failed && (
          <div className="panel-body">
            <Notice tone="error" role="alert">
              {t(
                'Không tải được báo cáo. Kiểm tra kết nối rồi thử lại.',
                'Could not load the report. Check the connection and try again.',
              )}
            </Notice>
          </div>
        )}
      </Panel>

      {!rangeError && !failed && report && (
        <>
          <section className="figures fibre">
            <p className="statement">
              {bestSeller
                ? t(
                    `Bán chạy nhất: ${localized(bestSeller.productName, locale)} với ${bestSeller.qty} phần.`,
                    `Best seller: ${localized(bestSeller.productName, locale)} with ${bestSeller.qty} sold.`,
                  )
                : t('Chưa có đơn nào trong khoảng ngày này.', 'No orders in this date range yet.')}
            </p>
            <div className="figure-grid">
              <div className="figure-cell">
                <span className="figure">{formatVnd(totalRevenue, locale)}</span>
                <span className="figure-label">{t('Doanh thu', 'Revenue')}</span>
              </div>
              <div className="figure-cell">
                <span className="figure">{totalOrders}</span>
                <span className="figure-label">{t('Đơn đã bán', 'Paid orders')}</span>
              </div>
              <div className="figure-cell">
                <span className="figure">{formatVnd(averageOrder, locale)}</span>
                <span className="figure-label">{t('Giá trị đơn TB', 'Avg. order')}</span>
              </div>
              <div className="figure-cell">
                <span className="figure">
                  {daysWithSales}/{days.length}
                </span>
                <span className="figure-label">{t('Ngày có doanh thu', 'Days with sales')}</span>
              </div>
            </div>
          </section>

          <Panel>
            <PanelHead title={t('Doanh thu theo ngày', 'Revenue by day')} />
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>{t('Ngày', 'Day')}</th>
                    <th className="num">{t('Đơn', 'Orders')}</th>
                    <th className="num">{t('Doanh thu', 'Revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.day}>
                      <td data-label={t('Ngày', 'Day')}>{formatDay(day.day, locale)}</td>
                      <td data-label={t('Đơn', 'Orders')} className="num">
                        {day.orders}
                      </td>
                      <td data-label={t('Doanh thu', 'Revenue')} className="num">
                        {formatVnd(day.revenueVnd, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
                      <strong>{t('Tổng', 'Total')}</strong>
                    </td>
                    <td className="num">
                      <strong>{totalOrders}</strong>
                    </td>
                    <td className="num">
                      <strong>{formatVnd(totalRevenue, locale)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHead title={t('Món bán chạy', 'Best sellers')} />
            {topProducts.length === 0 ? (
              <div className="panel-body">
                <EmptyState title={t('Chưa có món nào được bán', 'No products sold yet')}>
                  {t(
                    'Món bán chạy sẽ xuất hiện sau đơn đã thanh toán đầu tiên.',
                    'Best sellers appear after the first paid order.',
                  )}
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--ledger">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('Món', 'Product')}</th>
                      <th className="num">{t('SL bán', 'Qty sold')}</th>
                      <th className="num">{t('Doanh thu', 'Revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((product, index) => (
                      <tr key={product.productId}>
                        <td data-label="#">{index + 1}</td>
                        <td data-label={t('Món', 'Product')}>
                          <span className="cell-title">
                            {localized(product.productName, locale)}
                          </span>
                        </td>
                        <td data-label={t('SL bán', 'Qty sold')} className="num">
                          {product.qty}
                        </td>
                        <td data-label={t('Doanh thu', 'Revenue')} className="num">
                          {formatVnd(product.revenueVnd, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function ButtonLinkRange({ from, to, label }: { from: string; to: string; label: string }) {
  return (
    <Link className="btn btn--sm" href={`/admin/reports?from=${from}&to=${to}`}>
      {label}
    </Link>
  );
}
