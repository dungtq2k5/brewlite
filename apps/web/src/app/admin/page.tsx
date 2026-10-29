import Link from 'next/link';
import {
  adminCategoriesControllerList,
  adminProductsControllerList,
  adminToppingsControllerList,
  adminUsersControllerList,
  promotionsControllerList,
  staffOrdersControllerListBoard,
  type AdminCategoryResponseDto,
  type AdminToppingResponseDto,
  type OrderResponseDto,
} from '@brewlite/api-client';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelBody, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { localized } from '@/i18n/format';
import { readPage } from '@/lib/api-server';

interface SettledPage<T> {
  ok: boolean;
  rows: T[];
  total: number | null;
}

function settledPage<T>(result: PromiseSettledResult<{ data: unknown }>): SettledPage<T> {
  if (result.status === 'rejected') return { ok: false, rows: [], total: null };
  return { ok: true, ...readPage<T>(result.value.data) };
}

function pageCount(page: SettledPage<unknown>): number | null {
  return page.ok ? (page.total ?? page.rows.length) : null;
}

function Figure({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="figure-cell">
      <span className="figure">{value ?? '—'}</span>
      <span className="figure-label">{label}</span>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [users, products, categories, toppings, promotions, orders] = await Promise.allSettled([
    adminUsersControllerList({ pageSize: 1 }),
    adminProductsControllerList({ pageSize: 1 }),
    adminCategoriesControllerList(),
    adminToppingsControllerList(),
    promotionsControllerList({ pageSize: 1 }),
    staffOrdersControllerListBoard(),
  ]);

  const boardPage = settledPage<OrderResponseDto>(orders);
  const usersPage = settledPage<unknown>(users);
  const productsPage = settledPage<unknown>(products);
  const promotionsPage = settledPage<unknown>(promotions);
  const categoryPage = settledPage<AdminCategoryResponseDto>(categories);
  const toppingPage = settledPage<AdminToppingResponseDto>(toppings);

  const boardOrders = boardPage.rows;
  const statusCount = (status: string) =>
    boardOrders.filter((order) => order.status === status).length;

  const categoryRows = categoryPage.rows.slice(0, 6);
  const toppingRows = toppingPage.rows.slice(0, 5);

  return (
    <>
      <PageHead
        title="Tổng quan"
        meta="Số đếm đọc trực tiếp từ gateway, không có số liệu doanh thu giả."
        actions={
          <Link className="btn btn--sm" href="/admin">
            Tải lại
          </Link>
        }
      />

      <section className="figures fibre">
        <p className="statement">
          {boardPage.ok
            ? `Hiện có ${boardOrders.length} đơn trên bảng đơn của quầy.`
            : 'Không tải được bảng đơn lúc này.'}
        </p>
        <div className="figure-grid">
          <Figure value={boardOrders.length} label="Đơn trên bảng" />
          <Figure value={statusCount('PAID')} label="Chờ pha" />
          <Figure value={statusCount('PREPARING')} label="Đang pha" />
          <Figure value={statusCount('READY')} label="Chờ nhận" />
        </div>
      </section>

      <div className="overview-grid">
        <Panel>
          <PanelHead title="Danh mục vận hành" action={<Tag tone="muted">Đọc từ gateway</Tag>} />
          <PanelBody>
            <div className="account-list">
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Người dùng</span>
                <span className="num">{pageCount(usersPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Sản phẩm</span>
                <span className="num">{pageCount(productsPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Danh mục</span>
                <span className="num">{pageCount(categoryPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Topping</span>
                <span className="num">{pageCount(toppingPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Khuyến mãi</span>
                <span className="num">{pageCount(promotionsPage) ?? '—'}</span>
              </div>
            </div>
          </PanelBody>
          <p className="pagination">
            Bảng đơn dùng chung dữ liệu Staff. Doanh thu không hiển thị ở P0.
          </p>
        </Panel>

        <div className="stack">
          <Panel>
            <PanelHead
              title="Danh mục"
              action={
                <Link className="text-link" href="/admin/categories">
                  Quản lý
                </Link>
              }
            />
            <PanelBody>
              {categoryRows.length === 0 ? (
                <p className="muted">Không tải được danh mục.</p>
              ) : (
                <div className="account-list">
                  {categoryRows.map((category, index) => (
                    <div
                      className="account-row"
                      key={category.id}
                      style={{ gridTemplateColumns: '28px minmax(0, 1fr) auto' }}
                    >
                      <span className="muted">{String(index + 1).padStart(2, '0')}</span>
                      <span>{localized(category.name, 'vi')}</span>
                      <Tag tone={category.isActive ? 'success' : 'muted'}>
                        {category.isActive ? 'Bật' : 'Tắt'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead
              title="Topping"
              action={
                <Link className="text-link" href="/admin/toppings">
                  Quản lý
                </Link>
              }
            />
            <PanelBody>
              {toppingRows.length === 0 ? (
                <p className="muted">Không tải được topping.</p>
              ) : (
                <div className="account-list">
                  {toppingRows.map((topping) => (
                    <div
                      className="account-row"
                      key={topping.id}
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                    >
                      <span>{localized(topping.name, 'vi')}</span>
                      <Tag tone={topping.isAvailable ? 'success' : 'warning'}>
                        {topping.isAvailable ? 'Còn' : 'Hết'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>

      <section className="p1-note" style={{ marginTop: 'var(--space-md)' }}>
        <strong>P1: Đơn hàng và Báo cáo</strong>
        <span>
          Hai mục này chưa có endpoint riêng trong admin. Chúng xuất hiện ở dạng disabled, không gọi
          API và không dựng số liệu thay thế.
        </span>
      </section>
    </>
  );
}
