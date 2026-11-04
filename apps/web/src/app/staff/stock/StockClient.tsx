'use client';

import { Fragment, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  CategoryResponseDto,
  StaffProductResponseDto,
  StaffToppingResponseDto,
} from '@brewlite/api-client';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastProvider';
import ProductArtwork from '@/components/ProductArtwork';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useConsoleCopy } from '@/i18n/console-context';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import {
  setProductAvailabilityAction,
  setProductStockAction,
  setToppingAvailabilityAction,
} from '@/lib/staff-actions';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type Filter = 'all' | 'available' | 'unavailable';

function errorMessage(result: Failure, locale: Locale): { message: string; conflict: boolean } {
  const isVi = locale === 'vi';
  if (result.code === 'STOCK_VERSION_CONFLICT') {
    const details = result.details as { currentVersion?: unknown };
    const version =
      typeof details.currentVersion === 'number'
        ? isVi
          ? ` (phiên bản ${details.currentVersion})`
          : ` (version ${details.currentVersion})`
        : '';
    return {
      message: isVi
        ? `Một máy khác vừa đổi kho món này${version}. Tải lại dòng trước khi lưu để tránh ghi đè.`
        : `Another device just changed this product's stock${version}. Reload the row before saving to avoid overwriting it.`,
      conflict: true,
    };
  }
  return {
    message: describeError(result.code, result.details as ApiErrorDetails, locale),
    conflict: false,
  };
}

function categoryLabel(
  categories: CategoryResponseDto[],
  id: string,
  locale: Locale,
  fallback: string,
): string {
  const category = categories.find((row) => row.id === id);
  return category ? localized(category.name, locale) : fallback;
}

function ProductRow({
  product,
  category,
  imageUrl,
  onUpdated,
  onRefresh,
}: {
  product: StaffProductResponseDto;
  category: string;
  imageUrl?: string;
  onUpdated: (product: StaffProductResponseDto) => void;
  onRefresh: () => void;
}) {
  const { t, locale } = useConsoleCopy();
  const [stock, setStock] = useState(product.stockQty === null ? '' : String(product.stockQty));
  const [busy, setBusy] = useState<'availability' | 'stock' | null>(null);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [confirmAvailability, setConfirmAvailability] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setStock(product.stockQty === null ? '' : String(product.stockQty));
    setError(null);
  }, [product.id, product.stockQty, product.version]);

  const name = localized(product.name, locale);
  const altName = localized(product.name, locale === 'vi' ? 'en' : 'vi');
  const parsed = stock.trim() === '' ? null : Number(stock);
  const invalid = parsed !== null && (!Number.isInteger(parsed) || parsed < 0);
  const dirty = !invalid && parsed !== product.stockQty;

  const toggleAvailability = async () => {
    setBusy('availability');
    setError(null);
    try {
      const result = await runAction(
        setProductAvailabilityAction({
          productId: product.id,
          isAvailable: !product.isAvailable,
        }),
      );
      if (!result.ok) {
        setError(errorMessage(result, locale));
        return;
      }
      onUpdated(result.data);
      showToast(
        product.isAvailable
          ? t(
              `Đã ngừng bán ${name}. Khách không thể đặt món này.`,
              `${name} is no longer on sale. Customers cannot order it.`,
            )
          : t(`Đã bán lại ${name}.`, `${name} is back on sale.`),
        { tone: 'info' },
      );
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const saveStock = async () => {
    if (invalid || !dirty) return;
    setBusy('stock');
    setError(null);
    try {
      const result = await runAction(
        setProductStockAction({
          productId: product.id,
          stockQty: parsed,
          expectedVersion: product.version,
        }),
      );
      if (!result.ok) {
        setError(errorMessage(result, locale));
        return;
      }
      onUpdated(result.data);
      showToast(t(`Đã lưu kho cho ${name}.`, `Stock saved for ${name}.`));
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Fragment>
      <tr>
        <td data-label={t('Món', 'Product')}>
          <div className="stock-product">
            <div className="stock-thumb">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  sizes="44px"
                  unoptimized={
                    imageUrl.startsWith('http://localhost:29199') ||
                    imageUrl.startsWith('http://127.0.0.1:29199')
                  }
                />
              ) : (
                <ProductArtwork locale={locale} />
              )}
            </div>
            <div>
              <Link className="text-link" href={`/staff/products/${product.id}`}>
                {name}
              </Link>
              <span className="cell-meta">
                {altName && altName !== name ? altName : '—'} · v{product.version}
              </span>
            </div>
          </div>
        </td>
        <td data-label={t('Nhóm', 'Category')}>
          <Link className="text-link" href={`/staff/categories/${product.categoryId}`}>
            {category}
          </Link>
        </td>
        <td data-label={t('Kho', 'Stock')}>
          <input
            className="input stock-qty"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={stock}
            placeholder={t('Không giới hạn', 'Unlimited')}
            aria-label={t(`Số lượng kho ${name}`, `Stock quantity for ${name}`)}
            disabled={busy !== null}
            onChange={(event) => setStock(event.target.value)}
          />
          <span className="cell-meta">
            {stock.trim() === ''
              ? t('Không theo dõi kho', 'Stock not tracked')
              : t('Để trống = không giới hạn', 'Leave empty = unlimited')}
          </span>
        </td>
        <td data-label={t('Bán', 'On sale')}>
          <label className="switch">
            <input
              type="checkbox"
              checked={product.isAvailable}
              disabled={busy !== null}
              aria-label={t(`Còn bán ${name}`, `${name} is on sale`)}
              onChange={() => {
                if (busy === null) setConfirmAvailability(true);
              }}
            />
            <span className="switch-track" />
            <span className="switch-label">
              {product.isAvailable ? t('Đang bán', 'On sale') : t('Ngừng bán', 'Paused')}
            </span>
          </label>
        </td>
        <td data-label={t('Thao tác', 'Actions')} className="cell-actions">
          <Button size="sm" disabled={busy !== null || invalid || !dirty} onClick={saveStock}>
            {busy === 'stock' ? t('Đang lưu…', 'Saving…') : t('Lưu kho', 'Save stock')}
          </Button>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={5} style={{ paddingTop: 0 }}>
            <Notice tone="error" role="alert">
              {error.message}
              {error.conflict && (
                <div style={{ marginTop: 'var(--space-xs)' }}>
                  <Button size="sm" onClick={onRefresh}>
                    {t('Tải lại dòng', 'Reload row')}
                  </Button>
                </div>
              )}
            </Notice>
          </td>
        </tr>
      )}
      {confirmAvailability && (
        <ConfirmDialog
          title={
            product.isAvailable
              ? t(`Ngừng bán ${name}?`, `Pause ${name}?`)
              : t(`Bán lại ${name}?`, `Put ${name} back on sale?`)
          }
          confirmLabel={product.isAvailable ? t('Ngừng bán', 'Pause') : t('Bán lại', 'Resume')}
          cancelLabel={t('Giữ nguyên', 'Keep as is')}
          tone={product.isAvailable ? 'danger' : 'primary'}
          onCancel={() => setConfirmAvailability(false)}
          onConfirm={() => {
            setConfirmAvailability(false);
            void toggleAvailability();
          }}
        >
          <p>
            {product.isAvailable
              ? t(
                  `${name} sẽ biến mất khỏi menu của khách ngay khi lưu.`,
                  `${name} will disappear from the customer menu as soon as you save.`,
                )
              : t(
                  `${name} sẽ hiện lại trên menu của khách ngay khi lưu.`,
                  `${name} will reappear on the customer menu as soon as you save.`,
                )}
          </p>
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

function ToppingRow({
  topping,
  onUpdated,
  onRefresh,
}: {
  topping: StaffToppingResponseDto;
  onUpdated: (topping: StaffToppingResponseDto) => void;
  onRefresh: () => void;
}) {
  const { t, locale } = useConsoleCopy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAvailability, setConfirmAvailability] = useState(false);
  const { showToast } = useToast();
  const name = localized(topping.name, locale);
  const altName = localized(topping.name, locale === 'vi' ? 'en' : 'vi');

  const toggleAvailability = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runAction(
        setToppingAvailabilityAction({
          toppingId: topping.id,
          isAvailable: !topping.isAvailable,
        }),
      );
      if (!result.ok) {
        setError(errorMessage(result, locale).message);
        return;
      }
      onUpdated(result.data);
      showToast(
        topping.isAvailable
          ? t(`Đã ngừng bán ${name}.`, `${name} is no longer on sale.`)
          : t(`Đã bán lại ${name}.`, `${name} is back on sale.`),
        { tone: 'info' },
      );
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Fragment>
      <tr>
        <td data-label={t('Topping', 'Topping')}>
          <Link className="text-link" href={`/staff/toppings/${topping.id}`}>
            {name}
          </Link>
          {altName && altName !== name && <span className="cell-meta">{altName}</span>}
        </td>
        <td data-label={t('Giá', 'Price')} className="num">
          {formatVnd(topping.priceVnd, locale)}
        </td>
        <td data-label={t('Bán', 'On sale')}>
          <label className="switch">
            <input
              type="checkbox"
              checked={topping.isAvailable}
              disabled={busy}
              aria-label={t(`Còn ${name}`, `${name} is available`)}
              onChange={() => {
                if (!busy) setConfirmAvailability(true);
              }}
            />
            <span className="switch-track" />
            <span className="switch-label">
              {topping.isAvailable ? t('Đang bán', 'On sale') : t('Ngừng bán', 'Paused')}
            </span>
          </label>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={3} style={{ paddingTop: 0 }}>
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          </td>
        </tr>
      )}
      {confirmAvailability && (
        <ConfirmDialog
          title={
            topping.isAvailable
              ? t(`Ngừng bán ${name}?`, `Pause ${name}?`)
              : t(`Bán lại ${name}?`, `Put ${name} back on sale?`)
          }
          confirmLabel={topping.isAvailable ? t('Ngừng bán', 'Pause') : t('Bán lại', 'Resume')}
          cancelLabel={t('Giữ nguyên', 'Keep as is')}
          tone={topping.isAvailable ? 'danger' : 'primary'}
          onCancel={() => setConfirmAvailability(false)}
          onConfirm={() => {
            setConfirmAvailability(false);
            void toggleAvailability();
          }}
        >
          <p>
            {topping.isAvailable
              ? t(
                  `${name} sẽ không còn cho khách chọn kèm món.`,
                  `${name} will no longer be available as an add-on.`,
                )
              : t(
                  `${name} sẽ hiện lại trong phần topping của khách.`,
                  `${name} will reappear in the customer topping list.`,
                )}
          </p>
        </ConfirmDialog>
      )}
    </Fragment>
  );
}

export default function StockClient({
  products: initialProducts,
  toppings: initialToppings,
  categories,
  productImages,
  productsFailed,
  toppingsFailed,
}: {
  products: StaffProductResponseDto[];
  toppings: StaffToppingResponseDto[];
  categories: CategoryResponseDto[];
  productImages: Record<string, string>;
  productsFailed: boolean;
  toppingsFailed: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const [products, setProducts] = useState(initialProducts);
  const [toppings, setToppings] = useState(initialToppings);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => setProducts(initialProducts), [initialProducts]);
  useEffect(() => setToppings(initialToppings), [initialToppings]);

  const needle = query.trim().toLowerCase();
  const visibleProducts = products.filter((product) => {
    const matchesQuery =
      !needle ||
      localized(product.name, 'vi').toLowerCase().includes(needle) ||
      localized(product.name, 'en').toLowerCase().includes(needle);
    const matchesFilter =
      filter === 'all' || (filter === 'available' ? product.isAvailable : !product.isAvailable);
    return matchesQuery && matchesFilter;
  });

  const refresh = () => router.refresh();

  return (
    <div>
      <PageHead
        title={t('Kho & món', 'Stock & menu')}
        meta={t(
          `${products.length} món · ${toppings.length} topping`,
          `${products.length} products · ${toppings.length} toppings`,
        )}
        lede={t(
          'Bật/tắt món và topping đang bán, cập nhật tồn kho. Thay đổi có hiệu lực ngay với khách.',
          'Toggle products and toppings, update stock. Changes take effect for customers immediately.',
        )}
        actions={
          <ButtonLink href="/staff" variant="quiet" size="sm">
            ← {t('Bảng đơn', 'Order board')}
          </ButtonLink>
        }
      />

      {productsFailed && toppingsFailed ? (
        <EmptyState title={t('Không tải được dữ liệu kho', 'Could not load stock data')}>
          {t(
            'Chưa kết nối được hệ thống catalog. Thử làm mới sau ít phút.',
            'The catalog service is not reachable. Try refreshing in a moment.',
          )}
        </EmptyState>
      ) : (
        <div className="stack--lg">
          <Panel>
            <div className="toolbar">
              <div className="field">
                <label htmlFor="stock-search">{t('Tìm món', 'Search products')}</label>
                <input
                  id="stock-search"
                  className="input"
                  value={query}
                  placeholder={t(
                    'Tên món hoặc tên tiếng Anh',
                    'Product name, Vietnamese or English',
                  )}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant={filter === 'all' ? 'primary' : undefined}
                onClick={() => setFilter('all')}
              >
                {t('Tất cả', 'All')}
              </Button>
              <Button
                size="sm"
                variant={filter === 'available' ? 'primary' : undefined}
                onClick={() => setFilter('available')}
              >
                {t('Còn bán', 'On sale')}
              </Button>
              <Button
                size="sm"
                variant={filter === 'unavailable' ? 'primary' : undefined}
                onClick={() => setFilter('unavailable')}
              >
                {t('Ngừng bán', 'Paused')}
              </Button>
            </div>

            {productsFailed ? (
              <div className="panel-body">
                <Notice tone="warning">
                  {t('Không tải được danh sách món.', 'Could not load the product list.')}
                </Notice>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="panel-body">
                <EmptyState title={t('Không có món phù hợp', 'No matching products')}>
                  {t(
                    'Thử xóa từ khóa hoặc chọn bộ lọc khác.',
                    'Clear the search or choose a different filter.',
                  )}
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--ledger">
                  <thead>
                    <tr>
                      <th>{t('Món', 'Product')}</th>
                      <th>{t('Nhóm', 'Category')}</th>
                      <th>{t('Kho', 'Stock')}</th>
                      <th>{t('Bán', 'On sale')}</th>
                      <th className="num" style={{ textAlign: 'right' }}>
                        {t('Thao tác', 'Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        imageUrl={productImages[product.id]}
                        category={categoryLabel(
                          categories,
                          product.categoryId,
                          locale,
                          t('Khác', 'Other'),
                        )}
                        onUpdated={(updated) =>
                          setProducts((current) =>
                            current.map((row) => (row.id === updated.id ? updated : row)),
                          )
                        }
                        onRefresh={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead
              title="Topping"
              action={
                <Tag tone="muted">
                  {t(`${toppings.length} topping`, `${toppings.length} toppings`)}
                </Tag>
              }
            />
            {toppingsFailed ? (
              <div className="panel-body">
                <Notice tone="warning">
                  {t('Không tải được danh sách topping.', 'Could not load the topping list.')}
                </Notice>
              </div>
            ) : toppings.length === 0 ? (
              <div className="panel-body">
                <EmptyState title={t('Chưa có topping', 'No toppings yet')}>
                  {t('Topping sẽ xuất hiện khi được tạo.', 'Toppings appear here once created.')}
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th>Topping</th>
                      <th className="num">{t('Giá', 'Price')}</th>
                      <th>{t('Bán', 'On sale')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toppings.map((topping) => (
                      <ToppingRow
                        key={topping.id}
                        topping={topping}
                        onUpdated={(updated) =>
                          setToppings((current) =>
                            current.map((row) => (row.id === updated.id ? updated : row)),
                          )
                        }
                        onRefresh={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
