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
import { consoleCopy } from '@/i18n/console';
import { localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
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
  const locale = await getLocale();
  const { t } = consoleCopy(locale);
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
        title={t('Tổng quan', 'Overview')}
        meta={t(
          'Số đếm đọc trực tiếp từ hệ thống vận hành.',
          'Counts read directly from the live system.',
        )}
        actions={
          <Link className="btn btn--sm" href="/admin">
            {t('Tải lại', 'Reload')}
          </Link>
        }
      />

      <section className="figures fibre">
        <p className="statement">
          {boardPage.ok
            ? t(
                `Hiện có ${boardOrders.length} đơn trên bảng đơn của quầy.`,
                `${boardOrders.length} orders are on the counter board.`,
              )
            : t('Không tải được bảng đơn lúc này.', 'The order board could not be loaded.')}
        </p>
        <div className="figure-grid">
          <Figure value={boardOrders.length} label={t('Đơn trên bảng', 'Orders on board')} />
          <Figure value={statusCount('PAID')} label={t('Chờ pha', 'Waiting')} />
          <Figure value={statusCount('PREPARING')} label={t('Đang pha', 'Brewing')} />
          <Figure value={statusCount('READY')} label={t('Chờ nhận', 'Ready')} />
        </div>
      </section>

      <div className="overview-grid">
        <Panel>
          <PanelHead
            title={t('Danh mục vận hành', 'Operations')}
            action={<Tag tone="muted">{t('Dữ liệu trực tiếp', 'Live data')}</Tag>}
          />
          <PanelBody>
            <div className="account-list">
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>{t('Người dùng', 'Users')}</span>
                <span className="num">{pageCount(usersPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>{t('Sản phẩm', 'Products')}</span>
                <span className="num">{pageCount(productsPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>{t('Danh mục', 'Categories')}</span>
                <span className="num">{pageCount(categoryPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>Topping</span>
                <span className="num">{pageCount(toppingPage) ?? '—'}</span>
              </div>
              <div className="account-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <span>{t('Khuyến mãi', 'Promotions')}</span>
                <span className="num">{pageCount(promotionsPage) ?? '—'}</span>
              </div>
            </div>
          </PanelBody>
          <p className="pagination">
            {t(
              'Bảng đơn dùng chung dữ liệu với màn hình Staff.',
              'The order board shares data with the Staff view.',
            )}
          </p>
        </Panel>

        <div className="stack">
          <Panel>
            <PanelHead
              title={t('Danh mục', 'Categories')}
              action={
                <Link className="text-link" href="/admin/categories">
                  {t('Quản lý', 'Manage')}
                </Link>
              }
            />
            <PanelBody>
              {categoryRows.length === 0 ? (
                <p className="muted">
                  {t('Không tải được danh mục.', 'Categories could not be loaded.')}
                </p>
              ) : (
                <div className="account-list">
                  {categoryRows.map((category, index) => (
                    <div
                      className="account-row"
                      key={category.id}
                      style={{ gridTemplateColumns: '28px minmax(0, 1fr) auto' }}
                    >
                      <span className="muted">{String(index + 1).padStart(2, '0')}</span>
                      <span>{localized(category.name, locale)}</span>
                      <Tag tone={category.isActive ? 'success' : 'muted'}>
                        {category.isActive ? t('Bật', 'On') : t('Tắt', 'Off')}
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
                  {t('Quản lý', 'Manage')}
                </Link>
              }
            />
            <PanelBody>
              {toppingRows.length === 0 ? (
                <p className="muted">
                  {t('Không tải được topping.', 'Toppings could not be loaded.')}
                </p>
              ) : (
                <div className="account-list">
                  {toppingRows.map((topping) => (
                    <div
                      className="account-row"
                      key={topping.id}
                      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}
                    >
                      <span>{localized(topping.name, locale)}</span>
                      <Tag tone={topping.isAvailable ? 'success' : 'warning'}>
                        {topping.isAvailable ? t('Còn', 'Available') : t('Hết', 'Out')}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
