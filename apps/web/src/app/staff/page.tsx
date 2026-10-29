import type { OrderResponseDto } from '@brewlite/api-client';
import { staffOrdersControllerListBoard } from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { Tag } from '@/components/vellum/Tag';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
import { readPage } from '@/lib/api-server';

const COLUMNS = [
  { status: 'PAID', title: 'Chờ pha', hint: 'Đã thanh toán, chưa bắt đầu' },
  { status: 'PREPARING', title: 'Đang pha', hint: 'Đang chuẩn bị tại quầy' },
  { status: 'READY', title: 'Chờ nhận', hint: 'Sẵn sàng gọi khách' },
] as const;

export default async function StaffBoardPage() {
  let orders: OrderResponseDto[] = [];
  let failed = false;

  try {
    const response = await staffOrdersControllerListBoard();
    orders = readPage<OrderResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  const counts = COLUMNS.map((column) => ({
    ...column,
    orders: orders.filter((order) => order.status === column.status),
  }));

  return (
    <div>
      <PageHead
        title="Bảng đơn"
        meta={`Cập nhật ${formatDateTime(new Date().toISOString(), 'vi')} · chỉ đọc`}
        lede="Ba cột đúng ba trạng thái bếp: PAID, PREPARING, READY. Thao tác đổi trạng thái sẽ được nối ở phase Staff."
        actions={<Tag tone="muted">P0 · nền tảng</Tag>}
      />

      {failed ? (
        <EmptyState title="Không tải được bảng đơn">
          Gateway chưa trả dữ liệu. Thử tải lại trang sau khi kiểm tra kết nối.
        </EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState title="Chưa có đơn trên bảng">
          Đơn đã thanh toán sẽ xuất hiện ở đây khi khách đặt món.
        </EmptyState>
      ) : (
        <div className="board">
          {counts.map((column) => (
            <section
              className="board-column"
              key={column.status}
              aria-labelledby={`col-${column.status}`}
            >
              <div className="board-col-head">
                <h2 id={`col-${column.status}`}>{column.title}</h2>
                <span className="board-count">{column.orders.length} đơn</span>
              </div>
              <p
                className="muted"
                style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2xs)' }}
              >
                {column.hint}
              </p>
              {column.orders.length === 0 ? (
                <p
                  className="muted"
                  style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-md) 0' }}
                >
                  Không có đơn.
                </p>
              ) : (
                column.orders.map((order) => (
                  <article className="docket" key={order.id}>
                    <div className="docket-head">
                      <span className="docket-no">#{order.orderNo}</span>
                      <span className="docket-time">
                        {formatDateTime(order.createdAt, 'vi').split(' ')[0]}
                      </span>
                    </div>
                    <div className="docket-lines">
                      {order.lines.map((line, index) => (
                        <div className="docket-line" key={`${order.id}-${index}`}>
                          <span className="docket-qty">{line.qty}×</span>
                          <span className="docket-name">
                            {localized(line.productName, 'vi')}
                            <span className="docket-options">
                              Size {line.size}
                              {line.toppings.length > 0
                                ? `, ${line.toppings.map((topping) => localized(topping.name, 'vi')).join(', ')}`
                                : ''}
                            </span>
                          </span>
                          <span className="docket-price">{formatVnd(line.lineTotalVnd, 'vi')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="docket-total">
                      <span>Tổng</span>
                      <span>{formatVnd(order.totalVnd, 'vi')}</span>
                    </div>
                  </article>
                ))
              )}
            </section>
          ))}
        </div>
      )}

      <p className="console-note">
        Đây là bảng đọc từ <code>GET /staff/orders</code>. Nút chuyển trạng thái và hủy đơn đã thanh
        toán chưa được nối trong Phase 0.
      </p>
    </div>
  );
}
