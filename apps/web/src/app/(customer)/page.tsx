import Image from 'next/image';
import Link from 'next/link';
import {
  categoriesControllerList,
  productsControllerList,
  type CategoryResponseDto,
  type ProductSummaryResponseDto,
} from '@brewlite/api-client';
import AutoRefresh from '@/components/AutoRefresh';
import ProductArtwork from '@/components/ProductArtwork';
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

function MenuCard({
  product,
  categoryName,
  locale,
  eager,
}: {
  product: ProductSummaryResponseDto;
  categoryName?: string | null;
  locale: 'vi' | 'en';
  eager?: boolean;
}) {
  const isVi = locale === 'vi';
  const name = localized(product.name, locale);
  const alt = localized(product.name, isVi ? 'en' : 'vi');
  const image = product.imageUrl;

  return (
    <Link className="menu-card" href={`/products/${product.id}`}>
      <div className="menu-card-media">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 40rem) 50vw, (max-width: 60rem) 33vw, 320px"
            priority={eager}
            unoptimized={
              image.startsWith('http://localhost:29199') ||
              image.startsWith('http://127.0.0.1:29199')
            }
          />
        ) : (
          <ProductArtwork categoryName={categoryName} locale={locale} />
        )}
        {product.isSoldOut && (
          <span className="tag tag--error menu-card-badge">
            {isVi ? 'Tạm hết' : 'Temporarily out'}
          </span>
        )}
      </div>
      <div className="menu-card-body">
        <h3>{name}</h3>
        {alt && alt !== name && <p className="menu-card-alt">{alt}</p>}
        <p className="menu-card-price">
          <span className="menu-card-from">{isVi ? 'từ' : 'from'}</span>
          <span className="money">{formatVnd(product.fromPriceVnd, locale)}</span>
        </p>
      </div>
    </Link>
  );
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
      <AutoRefresh />
      <PageHead
        title={isVi ? 'Thực đơn hôm nay' : "Today's menu"}
        titleClassName="page-title--buyer"
        meta={meta}
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
                    <p className="menu-empty" style={{ padding: 'var(--space-sm) 0' }}>
                      {isVi ? 'Chưa có món trong nhóm này.' : 'No items in this group yet.'}
                    </p>
                  )}

                  <div className="menu-grid">
                    {group.products.map((product, index) => (
                      <MenuCard
                        key={product.id}
                        product={product}
                        categoryName={group.category.name.en}
                        locale={locale}
                        eager={index < 4 && group.category.id === visibleGroups[0]?.category.id}
                      />
                    ))}
                  </div>
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
              <div className="menu-grid">
                {uncategorized.map((product) => (
                  <MenuCard key={product.id} product={product} locale={locale} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
