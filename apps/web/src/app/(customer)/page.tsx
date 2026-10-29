import Image from 'next/image';
import Link from 'next/link';
import {
  categoriesControllerList,
  productsControllerList,
  type CategoryResponseDto,
  type ProductSummaryResponseDto,
} from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { formatVnd, localized } from '@/i18n/format';
import { getLocale } from '@/i18n/locale.server';
import { unwrap } from '@/lib/api-server';

interface MenuPageProps {
  searchParams: Promise<{ categoryId?: string | string[] }>;
}

interface MenuGroup {
  category: CategoryResponseDto;
  products: ProductSummaryResponseDto[];
}

export default async function MenuPage({ searchParams }: MenuPageProps) {
  const [{ categoryId }, locale] = await Promise.all([searchParams, getLocale()]);
  const isVi = locale === 'vi';
  const selectedId = Array.isArray(categoryId) ? categoryId[0] : categoryId;

  const [categoriesResult, productsResult] = await Promise.allSettled([
    categoriesControllerList(),
    productsControllerList(),
  ]);

  const categories =
    categoriesResult.status === 'fulfilled'
      ? unwrap<CategoryResponseDto[]>(categoriesResult.value.data)
      : [];
  const products =
    productsResult.status === 'fulfilled'
      ? unwrap<ProductSummaryResponseDto[]>(productsResult.value.data)
      : [];
  const failed = categoriesResult.status === 'rejected' || productsResult.status === 'rejected';

  const groups: MenuGroup[] = categories.map((category) => ({
    category,
    products: products.filter((product) => product.categoryId === category.id),
  }));
  const knownCategoryIds = new Set(categories.map((category) => category.id));
  const uncategorized = products.filter((product) => !knownCategoryIds.has(product.categoryId));
  const selected = groups.find((group) => group.category.id === selectedId) ?? null;
  const visibleGroups = selected ? [selected] : groups;

  const today = new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const itemLabel = isVi ? 'món' : 'items';
  const meta = isVi
    ? `${today}. Quầy mở 07:00–21:00. ${products.length} ${itemLabel}, ${categories.length} nhóm.`
    : `${today}. Counter open 07:00–21:00. ${products.length} ${itemLabel}, ${categories.length} groups.`;

  return (
    <>
      <PageHead
        title={isVi ? 'Thực đơn hôm nay' : "Today's menu"}
        titleClassName="page-title--buyer"
        meta={meta}
        lede={
          isVi
            ? 'Chọn size và topping ở trang món; giá cuối cùng hiện trước khi thêm vào giỏ.'
            : 'Choose size and toppings on the item page to see the final price before adding it.'
        }
        actions={
          <>
            <Link className="btn btn--sm" href="/orders">
              {isVi ? 'Đơn của tôi' : 'My orders'}
            </Link>
            {selected && (
              <Link className="btn btn--sm btn--primary" href="/">
                {isVi ? 'Tất cả món' : 'All items'}
              </Link>
            )}
          </>
        }
      />

      {failed && (
        <Notice tone="warning" role="status" className="menu-notice">
          {isVi
            ? 'Không tải được toàn bộ thực đơn lúc này. Danh sách bên dưới có thể chưa đầy đủ.'
            : 'The full menu could not be loaded. The list below may be incomplete.'}
        </Notice>
      )}

      <div className="menu-layout">
        <aside className="menu-rail" aria-label={isVi ? 'Nhóm món' : 'Menu groups'}>
          <nav className="index-nav">
            {groups.map((group, index) => {
              const active = selected?.category.id === group.category.id;
              return (
                <Link
                  key={group.category.id}
                  className={active ? 'index-link is-active' : 'index-link'}
                  href={`/?categoryId=${group.category.id}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="index-num">{String(index + 1).padStart(2, '0')}</span>
                  <span>{localized(group.category.name, locale)}</span>
                  <span className="index-count">{group.products.length}</span>
                </Link>
              );
            })}
          </nav>

          <figure className="menu-figure">
            <div className="menu-photo">
              <Image
                src="/menu-espresso.jpg"
                alt={
                  isVi
                    ? 'Espresso đang chảy từ máy xuống hai ly thuỷ tinh'
                    : 'Espresso pouring from a retro machine into two glasses'
                }
                fill
                sizes="(max-width: 60rem) 100vw, 236px"
              />
            </div>
            <figcaption className="photo-credit">
              <Link className="text-link" href="/credits">
                {isVi
                  ? 'Ảnh minh hoạ: Shixart1985 · CC BY 2.0'
                  : 'Illustration: Shixart1985 · CC BY 2.0'}
              </Link>
            </figcaption>
          </figure>

          <div className="menu-note">
            <p className="menu-note-title">{isVi ? 'Pha theo từng ly' : 'Made to order'}</p>
            <p>
              {isVi
                ? 'Mỗi ly được pha khi đơn vào bếp. Món hết nguyên liệu sẽ bị khóa ở bước đặt đơn.'
                : 'Each drink is made when the order reaches the bar. Sold-out items are locked at checkout.'}
            </p>
          </div>
        </aside>

        <div>
          {products.length === 0 ? (
            <EmptyState
              title={isVi ? 'Thực đơn đang trống' : 'The menu is empty'}
              action={
                <Link className="btn btn--primary" href="/">
                  {isVi ? 'Tải lại thực đơn' : 'Reload the menu'}
                </Link>
              }
            >
              {failed
                ? isVi
                  ? 'Chưa kết nối được catalog. Thử lại sau ít phút.'
                  : 'The catalog is unreachable. Try again in a moment.'
                : isVi
                  ? 'Chưa có món nào được mở bán.'
                  : 'No items are on sale yet.'}
            </EmptyState>
          ) : (
            visibleGroups.map((group) => {
              const altName = localized(group.category.name, isVi ? 'en' : 'vi');
              const primaryName = localized(group.category.name, locale);
              return (
                <section
                  className="menu-section"
                  id={`cat-${group.category.id}`}
                  key={group.category.id}
                >
                  <div className="menu-section-head">
                    <h2>
                      {primaryName}{' '}
                      {altName && altName !== primaryName && (
                        <span
                          className="muted"
                          style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}
                        >
                          {altName}
                        </span>
                      )}
                    </h2>
                    <span className="menu-count">
                      {group.products.length} {isVi ? 'món' : 'items'}
                    </span>
                  </div>

                  {group.products.length === 0 && (
                    <p className="menu-row-meta" style={{ padding: 'var(--space-sm) 0' }}>
                      {isVi ? 'Chưa có món trong nhóm này.' : 'No items in this group yet.'}
                    </p>
                  )}

                  {group.products.map((product) => {
                    const name = localized(product.name, locale);
                    const alt = localized(product.name, isVi ? 'en' : 'vi');
                    return (
                      <div className="menu-row" key={product.id}>
                        <div>
                          <h3>
                            <Link href={`/products/${product.id}`}>{name}</Link>
                          </h3>
                          {alt && alt !== name && <p className="menu-row-meta">{alt}</p>}
                        </div>
                        <div className="menu-row-price">
                          <span className="menu-from">{isVi ? 'từ' : 'from'}</span>
                          <span className="money">{formatVnd(product.fromPriceVnd, locale)}</span>
                        </div>
                        {product.isSoldOut ? (
                          <span className="tag tag--error">{isVi ? 'Hết hàng' : 'Sold out'}</span>
                        ) : (
                          <Link
                            className="menu-add"
                            href={`/products/${product.id}`}
                            aria-label={isVi ? `Xem món ${name}` : `View ${name}`}
                          >
                            {isVi ? 'Xem' : 'View'}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })
          )}

          {uncategorized.length > 0 && (
            <section className="menu-section">
              <div className="menu-section-head">
                <h2>{isVi ? 'Khác' : 'Other'}</h2>
                <span className="menu-count">
                  {uncategorized.length} {isVi ? 'món' : 'items'}
                </span>
              </div>
              {uncategorized.map((product) => {
                const name = localized(product.name, locale);
                return (
                  <div className="menu-row" key={product.id}>
                    <div>
                      <h3>
                        <Link href={`/products/${product.id}`}>{name}</Link>
                      </h3>
                    </div>
                    <div className="menu-row-price">
                      <span className="menu-from">{isVi ? 'từ' : 'from'}</span>
                      <span className="money">{formatVnd(product.fromPriceVnd, locale)}</span>
                    </div>
                    {product.isSoldOut ? (
                      <span className="tag tag--error">{isVi ? 'Hết hàng' : 'Sold out'}</span>
                    ) : (
                      <Link
                        className="menu-add"
                        href={`/products/${product.id}`}
                        aria-label={isVi ? `Xem món ${name}` : `View ${name}`}
                      >
                        {isVi ? 'Xem' : 'View'}
                      </Link>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
