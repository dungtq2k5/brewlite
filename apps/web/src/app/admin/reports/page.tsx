import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';

const PLANNED_REPORTS = [
  {
    title: 'Doanh thu theo ngày',
    detail: 'Tổng hợp từ đơn đã hoàn tất, tách theo ngày và phương thức thanh toán.',
  },
  {
    title: 'Món bán chạy',
    detail: 'Xếp hạng theo sản phẩm, size và topping.',
  },
  {
    title: 'Hiệu quả khuyến mãi',
    detail: 'Số lượt dùng, tổng giảm và tỷ lệ đơn có mã.',
  },
];

export default function AdminReportsPage() {
  return (
    <>
      <PageHead
        title="Báo cáo"
        meta="Chưa có dữ liệu tổng hợp"
        lede="Doanh thu, món bán chạy và hiệu quả khuyến mãi cần dữ liệu tổng hợp từ hệ thống. Trang sẽ hiển thị số liệu khi nguồn dữ liệu sẵn sàng."
        actions={
          <button className="btn btn--sm" type="button" disabled>
            Xuất báo cáo
          </button>
        }
      />

      <Panel>
        <PanelHead title="Sẽ có" />
        <ul className="task-list">
          {PLANNED_REPORTS.map((report) => (
            <li className="task-row is-disabled" key={report.title}>
              <span className="task-title">{report.title}</span>
              <span className="task-detail">{report.detail}</span>
            </li>
          ))}
        </ul>
        <div className="panel-body">
          <p className="fine">
            Số liệu sẽ được tổng hợp từ đơn đã hoàn tất; không dùng số ước lượng.
          </p>
        </div>
      </Panel>
    </>
  );
}
