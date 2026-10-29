import {
  adminProductsControllerList,
  type AdminProductListItemResponseDto,
} from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd, localized } from '@/i18n/format';
import { nullableText } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';

function ProductStatus({ product }: { product: AdminProductListItemResponseDto }) {
  if (nullableText(product.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!product.isAvailable) return <Tag tone="warning">Tạm ngừng</Tag>;
  return <Tag tone="success">Đang bán</Tag>;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  let pageNumber = parsePageParam((await searchParams).page);
  let rows: AdminProductListItemResponseDto[] = [];
  let total: number | null = null;
  let failed = false;

  try {
    const load = (page: number) =>
      adminProductsControllerList({ page, pageSize: ADMIN_PAGE_SIZE, sort: 'sortOrder' });

    let response = await load(pageNumber);
    let page = readPage<AdminProductListItemResponseDto>(response.data);
    const totalPages = Math.max(1, Math.ceil((page.total ?? page.rows.length) / ADMIN_PAGE_SIZE));
    if (pageNumber > totalPages) {
      pageNumber = totalPages;
      response = await load(pageNumber);
      page = readPage<AdminProductListItemResponseDto>(response.data);
    }
    rows = page.rows;
    total = page.total;
  } catch {
    failed = true;
  }

  return (
    <>
      <PageHead
        title="Sản phẩm"
        meta={failed ? 'Không đọc được dữ liệu' : `${total ?? rows.length} sản phẩm`}
        lede="Danh sách đọc từ menu thật trong catalog. P0 chỉ xem; form thêm và sửa sản phẩm chưa được nối."
      />

      {failed ? (
        <Notice tone="error">
          <strong>Không tải được sản phẩm.</strong> Kiểm tra kết nối tới gateway rồi tải lại trang.
        </Notice>
      ) : (
        <Panel>
          {rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Chưa có sản phẩm">
                Gateway trả danh sách rỗng. Món mới sẽ xuất hiện ở đây.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Nhóm</th>
                    <th className="num">Giá gốc</th>
                    <th>Kho</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr key={product.id}>
                      <td data-label="Sản phẩm">
                        <span className="cell-title">{localized(product.name, 'vi')}</span>
                        <span className="cell-meta">{product.name.en}</span>
                      </td>
                      <td data-label="Nhóm">{localized(product.categoryName, 'vi')}</td>
                      <td data-label="Giá gốc" className="num">
                        {formatVnd(product.basePriceVnd, 'vi')}
                      </td>
                      <td data-label="Kho">
                        {product.stockQty === null ? (
                          <span className="muted">Không theo dõi</span>
                        ) : (
                          product.stockQty
                        )}
                      </td>
                      <td data-label="Trạng thái">
                        <ProductStatus product={product} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(total ?? rows.length) > 0 && (
            <Pagination
              basePath="/admin/products"
              page={pageNumber}
              pageSize={ADMIN_PAGE_SIZE}
              total={total ?? rows.length}
              label="sản phẩm"
              note="sắp theo thứ tự menu"
            />
          )}
        </Panel>
      )}
    </>
  );
}
