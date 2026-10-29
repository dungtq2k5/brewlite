import { adminCategoriesControllerList, type AdminCategoryResponseDto } from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { localized } from '@/i18n/format';
import { nullableText } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';

function CategoryStatus({ category }: { category: AdminCategoryResponseDto }) {
  if (nullableText(category.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!category.isActive) return <Tag tone="muted">Tạm ẩn</Tag>;
  return <Tag tone="success">Đang dùng</Tag>;
}

export default async function AdminCategoriesPage() {
  let rows: AdminCategoryResponseDto[] = [];
  let failed = false;

  try {
    const response = await adminCategoriesControllerList();
    rows = readPage<AdminCategoryResponseDto>(response.data).rows;
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHead
        title="Danh mục"
        meta={failed ? 'Không đọc được dữ liệu' : `${rows.length} danh mục`}
        lede="Danh mục đọc từ catalog thật. Trang này chỉ để đối chiếu; thêm, sửa và xóa danh mục chưa hỗ trợ trên giao diện."
      />

      {failed ? (
        <Notice tone="error">
          <strong>Không tải được danh mục.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      ) : (
        <Panel>
          {rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Chưa có danh mục">
                Hệ thống chưa trả về danh mục nào. Danh mục mới sẽ xuất hiện ở đây.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th className="num">Thứ tự</th>
                    <th>Danh mục</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((category) => (
                    <tr key={category.id}>
                      <td data-label="Thứ tự" className="num">
                        {String(category.sortOrder).padStart(2, '0')}
                      </td>
                      <td data-label="Danh mục">
                        <span className="cell-title">{localized(category.name, 'vi')}</span>
                        <span className="cell-meta">{category.name.en}</span>
                      </td>
                      <td data-label="Trạng thái">
                        <CategoryStatus category={category} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pagination">
            <span>{rows.length} danh mục, sắp theo thứ tự hiển thị.</span>
          </p>
        </Panel>
      )}

      <p className="fine">
        DTO danh mục không trả số sản phẩm, nên màn này không dựng cột đếm thay thế.
      </p>
    </>
  );
}
