import { ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';

const PLANNED_REPORTS = [
  {
    title: 'Doanh thu theo ngày',
    detail: 'Cần tổng hợp từ đơn COMPLETED, tách theo ngày và phương thức thanh toán.',
  },
  {
    title: 'Món bán chạy',
    detail: 'Cần tổng hợp dòng đơn theo sản phẩm, size và topping.',
  },
  {
    title: 'Hiệu quả khuyến mãi',
    detail: 'Cần số lượt dùng, tổng giảm và tỷ lệ đơn có mã.',
  },
];

export default function AdminReportsPage() {
  return (
    <>
      <PageHead
        title="Báo cáo"
        meta="P1: chưa mở, không có endpoint tổng hợp"
        lede="Trang cố ý để trống thay vì bịa doanh thu. Các khối bên dưới là phạm vi dự kiến khi mở P1."
        actions={
          <button className="btn btn--sm" type="button" disabled>
            Xuất báo cáo
          </button>
        }
      />

      <Panel>
        <PanelHead
          title="Phạm vi dự kiến"
          action={
            <Tag tone="muted" className="tag--p1">
              P1
            </Tag>
          }
        />
        <ul className="task-list">
          {PLANNED_REPORTS.map((report) => (
            <li className="task-row is-disabled" key={report.title}>
              <span className="task-title">
                {report.title} <Tag className="tag--p1">P1</Tag>
              </span>
              <span className="task-detail">{report.detail}</span>
            </li>
          ))}
        </ul>
        <div className="panel-body">
          <p className="fine">
            Chưa có endpoint tổng hợp trong gateway. Không dựng biểu đồ khi thiếu nguồn dữ liệu.
          </p>
        </div>
      </Panel>

      <div className="overview-grid">
        <EmptyState
          title="Không có số liệu để hiển thị"
          action={<ButtonLink href="/admin/orders">Xem màn đơn hàng P1</ButtonLink>}
        >
          Khi mở P1, mỗi khối cần trạng thái đang tải, rỗng, lỗi và đầy đủ. P0 chỉ trình bày trạng
          thái rỗng.
        </EmptyState>
        <section className="p1-note">
          <strong>Vì sao không có số?</strong>
          <span>
            Doanh thu, số đơn và tăng trưởng phải lấy từ dữ liệu thật. Dùng số mẫu ở đây sẽ khiến
            người duyệt hiểu sai phạm vi P0.
          </span>
        </section>
      </div>
    </>
  );
}
