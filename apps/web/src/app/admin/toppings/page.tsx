import { adminToppingsControllerList, type AdminToppingResponseDto } from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd, localized } from '@/i18n/format';
import { nullableText } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';

function ToppingStatus({ topping }: { topping: AdminToppingResponseDto }) {
  if (nullableText(topping.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!topping.isAvailable) return <Tag tone="warning">Tạm hết</Tag>;
  return <Tag tone="success">Đang bán</Tag>;
}

export default async function AdminToppingsPage() {
  let rows: AdminToppingResponseDto[] = [];
  let failed = false;

  try {
    const response = await adminToppingsControllerList();
    rows = readPage<AdminToppingResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHead
        title="Topping"
        meta={failed ? 'Không đọc được dữ liệu' : `${rows.length} topping`}
        lede="Topping dùng chung cho mọi sản phẩm được gán. P0 chỉ xem; đổi trạng thái và sửa giá chưa được nối."
      />

      {failed ? (
        <Notice tone="error">
          <strong>Không tải được topping.</strong> Kiểm tra kết nối tới gateway rồi tải lại trang.
        </Notice>
      ) : (
        <Panel>
          {rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Chưa có topping">
                Gateway trả danh sách rỗng. Topping mới sẽ xuất hiện ở đây.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>Topping</th>
                    <th className="num">Giá</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((topping) => (
                    <tr key={topping.id}>
                      <td data-label="Topping">
                        <span className="cell-title">{localized(topping.name, 'vi')}</span>
                        <span className="cell-meta">{topping.name.en}</span>
                      </td>
                      <td data-label="Giá" className="num">
                        {formatVnd(topping.priceVnd, 'vi')}
                      </td>
                      <td data-label="Trạng thái">
                        <ToppingStatus topping={topping} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pagination">
            <span>{rows.length} topping, gồm cả mục đã xóa mềm nếu gateway trả về.</span>
          </p>
        </Panel>
      )}
    </>
  );
}
