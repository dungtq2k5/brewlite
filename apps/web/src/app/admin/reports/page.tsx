import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';

export default async function AdminReportsPage() {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  const plannedReports = [
    {
      title: t('Doanh thu theo ngày', 'Revenue by day'),
      detail: t(
        'Tổng hợp từ đơn đã hoàn tất, tách theo ngày và phương thức thanh toán.',
        'Aggregated from completed orders, split by day and payment method.',
      ),
    },
    {
      title: t('Món bán chạy', 'Best sellers'),
      detail: t('Xếp hạng theo sản phẩm, size và topping.', 'Ranked by product, size and topping.'),
    },
    {
      title: t('Hiệu quả khuyến mãi', 'Promotion performance'),
      detail: t(
        'Số lượt dùng, tổng giảm và tỷ lệ đơn có mã.',
        'Redemptions, total discount and share of orders using a code.',
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t('Báo cáo', 'Reports')}
        meta={t('Chưa có dữ liệu tổng hợp', 'No aggregated data yet')}
        lede={t(
          'Doanh thu, món bán chạy và hiệu quả khuyến mãi cần dữ liệu tổng hợp từ hệ thống. Trang sẽ hiển thị số liệu khi nguồn dữ liệu sẵn sàng.',
          'Revenue, best sellers and promotion performance need aggregated data. This page will show figures once the data source is ready.',
        )}
        actions={
          <button className="btn btn--sm" type="button" disabled>
            {t('Xuất báo cáo', 'Export report')}
          </button>
        }
      />

      <Panel>
        <PanelHead title={t('Sẽ có', 'Planned')} />
        <ul className="task-list">
          {plannedReports.map((report) => (
            <li className="task-row is-disabled" key={report.title}>
              <span className="task-title">{report.title}</span>
              <span className="task-detail">{report.detail}</span>
            </li>
          ))}
        </ul>
        <div className="panel-body">
          <p className="fine">
            {t(
              'Số liệu sẽ được tổng hợp từ đơn đã hoàn tất; không dùng số ước lượng.',
              'Figures will be aggregated from completed orders, never estimated.',
            )}
          </p>
        </div>
      </Panel>
    </>
  );
}
