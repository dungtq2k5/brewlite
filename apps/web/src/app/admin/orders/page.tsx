import { ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';

export default function AdminOrdersPage() {
  return (
    <>
      <PageHead
        title="Đơn hàng"
        meta="P1: chưa mở, không có endpoint admin riêng"
        lede="Màn này cần danh sách đơn toàn hệ thống kèm lọc và phân trang. Hiện admin dùng chung bảng đơn của Staff."
        actions={
          <button className="btn btn--sm" type="button" disabled>
            Xuất CSV
          </button>
        }
      />

      <Panel>
        <div className="filters" aria-disabled="true">
          <div className="field">
            <label htmlFor="admin-order-q">Tìm mã đơn</label>
            <input className="input" id="admin-order-q" placeholder="1042" disabled />
          </div>
          <div className="field">
            <label htmlFor="admin-order-state">Trạng thái</label>
            <select id="admin-order-state" disabled defaultValue="">
              <option value="">Tất cả</option>
              <option value="PAID">PAID</option>
              <option value="PREPARING">PREPARING</option>
              <option value="READY">READY</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="admin-order-date">Ngày</label>
            <input className="input" id="admin-order-date" type="date" disabled />
          </div>
          <button className="btn btn--primary" type="button" disabled>
            Lọc
          </button>
        </div>

        <div className="panel-body">
          <EmptyState
            title="P1: chưa có dữ liệu"
            action={<ButtonLink href="/staff">Mở bảng đơn Staff</ButtonLink>}
          >
            Không hiển thị đơn giả trên màn admin. Khi mở P1, bảng sẽ đọc từ endpoint đơn toàn hệ
            thống.
          </EmptyState>
        </div>

        <p className="pagination">
          <span>0 đơn</span>
          <span className="pagination-actions">
            <button className="btn btn--sm" type="button" disabled>
              Trước
            </button>
            <button className="btn btn--sm" type="button" disabled>
              Sau
            </button>
          </span>
        </p>
      </Panel>

      <section className="p1-note" style={{ marginTop: 'var(--space-md)' }}>
        <strong>Điều kiện mở P1</strong>
        <span>
          Cần endpoint danh sách đơn có lọc trạng thái, ngày và khách, cùng quyền
          <code>order.read.all</code>. Chưa có trong gateway nên màn này chỉ để duyệt bố cục.
        </span>
      </section>
    </>
  );
}
