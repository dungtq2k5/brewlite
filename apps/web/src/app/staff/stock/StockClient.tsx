'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CategoryResponseDto,
  StaffProductResponseDto,
  StaffToppingResponseDto,
} from '@brewlite/api-client';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd, localized } from '@/i18n/format';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import {
  setProductAvailabilityAction,
  setProductStockAction,
  setToppingAvailabilityAction,
} from '@/lib/staff-actions';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type Filter = 'all' | 'available' | 'unavailable';

function errorMessage(result: Failure): { message: string; conflict: boolean } {
  if (result.code === 'STOCK_VERSION_CONFLICT') {
    const details = result.details as { currentVersion?: unknown };
    const version =
      typeof details.currentVersion === 'number' ? ` (phiên bản ${details.currentVersion})` : '';
    return {
      message: `Một máy khác vừa đổi kho món này${version}. Tải lại dòng trước khi lưu để tránh ghi đè.`,
      conflict: true,
    };
  }
  return {
    message: describeError(result.code, result.details as ApiErrorDetails, 'vi'),
    conflict: false,
  };
}

function categoryLabel(categories: CategoryResponseDto[], id: string): string {
  const category = categories.find((row) => row.id === id);
  return category ? localized(category.name, 'vi') : 'Khác';
}

function ProductRow({
  product,
  category,
  onUpdated,
  onRefresh,
}: {
  product: StaffProductResponseDto;
  category: string;
  onUpdated: (product: StaffProductResponseDto) => void;
  onRefresh: () => void;
}) {
  const [stock, setStock] = useState(product.stockQty === null ? '' : String(product.stockQty));
  const [busy, setBusy] = useState<'availability' | 'stock' | null>(null);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);

  useEffect(() => {
    setStock(product.stockQty === null ? '' : String(product.stockQty));
    setError(null);
  }, [product.id, product.stockQty, product.version]);

  const name = localized(product.name, 'vi');
  const altName = localized(product.name, 'en');
  const parsed = stock.trim() === '' ? null : Number(stock);
  const invalid = parsed !== null && (!Number.isInteger(parsed) || parsed < 0);
  const dirty = !invalid && parsed !== product.stockQty;

  const toggleAvailability = async () => {
    setBusy('availability');
    setError(null);
    const result = await setProductAvailabilityAction({
      productId: product.id,
      isAvailable: !product.isAvailable,
    });
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    onUpdated(result.data);
    onRefresh();
  };

  const saveStock = async () => {
    if (invalid || !dirty) return;
    setBusy('stock');
    setError(null);
    const result = await setProductStockAction({
      productId: product.id,
      stockQty: parsed,
      expectedVersion: product.version,
    });
    setBusy(null);
    if (!result.ok) {
      setError(errorMessage(result));
      return;
    }
    onUpdated(result.data);
    onRefresh();
  };

  return (
    <Fragment>
      <tr>
        <td data-label="Món">
          <span className="cell-title">{name}</span>
          <span className="cell-meta">
            {altName && altName !== name ? altName : '—'} · v{product.version}
          </span>
        </td>
        <td data-label="Nhóm">{category}</td>
        <td data-label="Kho">
          <input
            className="input"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={stock}
            placeholder="Không giới hạn"
            aria-label={`Số lượng kho ${name}`}
            disabled={busy !== null}
            style={{ maxWidth: 120 }}
            onChange={(event) => setStock(event.target.value)}
          />
          <span className="cell-meta">
            {stock.trim() === '' ? 'Không theo dõi kho' : 'Để trống = không giới hạn'}
          </span>
        </td>
        <td data-label="Bán">
          <label className="switch">
            <input
              type="checkbox"
              checked={product.isAvailable}
              disabled={busy !== null}
              aria-label={`Còn bán ${name}`}
              onChange={toggleAvailability}
            />
            <span className="switch-track" />
            <span className="switch-label">{product.isAvailable ? 'Đang bán' : 'Ngừng bán'}</span>
          </label>
        </td>
        <td data-label="Thao tác" className="cell-actions">
          <Button size="sm" disabled={busy !== null || invalid || !dirty} onClick={saveStock}>
            {busy === 'stock' ? 'Đang lưu…' : 'Lưu kho'}
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
                    Tải lại dòng
                  </Button>
                </div>
              )}
            </Notice>
          </td>
        </tr>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = localized(topping.name, 'vi');
  const altName = localized(topping.name, 'en');

  const toggleAvailability = async () => {
    setBusy(true);
    setError(null);
    const result = await setToppingAvailabilityAction({
      toppingId: topping.id,
      isAvailable: !topping.isAvailable,
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result).message);
      return;
    }
    onUpdated(result.data);
    onRefresh();
  };

  return (
    <Fragment>
      <tr>
        <td data-label="Topping">
          <span className="cell-title">{name}</span>
          {altName && altName !== name && <span className="cell-meta">{altName}</span>}
        </td>
        <td data-label="Giá" className="num">
          {formatVnd(topping.priceVnd, 'vi')}
        </td>
        <td data-label="Bán">
          <label className="switch">
            <input
              type="checkbox"
              checked={topping.isAvailable}
              disabled={busy}
              aria-label={`Còn ${name}`}
              onChange={toggleAvailability}
            />
            <span className="switch-track" />
            <span className="switch-label">{topping.isAvailable ? 'Đang bán' : 'Ngừng bán'}</span>
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
    </Fragment>
  );
}

export default function StockClient({
  products: initialProducts,
  toppings: initialToppings,
  categories,
  productsFailed,
  toppingsFailed,
}: {
  products: StaffProductResponseDto[];
  toppings: StaffToppingResponseDto[];
  categories: CategoryResponseDto[];
  productsFailed: boolean;
  toppingsFailed: boolean;
}) {
  const router = useRouter();
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
        title="Kho & món"
        meta={`${products.length} món · ${toppings.length} topping`}
        lede="Bật/tắt món và topping đang bán, cập nhật tồn kho. Thay đổi có hiệu lực ngay với khách."
        actions={
          <ButtonLink href="/staff" variant="quiet" size="sm">
            ← Bảng đơn
          </ButtonLink>
        }
      />

      {productsFailed && toppingsFailed ? (
        <EmptyState title="Không tải được dữ liệu kho">
          Chưa kết nối được hệ thống catalog. Thử làm mới sau ít phút.
        </EmptyState>
      ) : (
        <div className="stack--lg">
          <Panel>
            <div className="toolbar">
              <div className="field">
                <label htmlFor="stock-search">Tìm món</label>
                <input
                  id="stock-search"
                  className="input"
                  value={query}
                  placeholder="Tên món hoặc tên tiếng Anh"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant={filter === 'all' ? 'primary' : undefined}
                onClick={() => setFilter('all')}
              >
                Tất cả
              </Button>
              <Button
                size="sm"
                variant={filter === 'available' ? 'primary' : undefined}
                onClick={() => setFilter('available')}
              >
                Còn bán
              </Button>
              <Button
                size="sm"
                variant={filter === 'unavailable' ? 'primary' : undefined}
                onClick={() => setFilter('unavailable')}
              >
                Ngừng bán
              </Button>
            </div>

            {productsFailed ? (
              <div className="panel-body">
                <Notice tone="warning">Không tải được danh sách món.</Notice>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Không có món phù hợp">
                  Thử xóa từ khóa hoặc chọn bộ lọc khác.
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--ledger">
                  <thead>
                    <tr>
                      <th>Món</th>
                      <th>Nhóm</th>
                      <th>Kho</th>
                      <th>Bán</th>
                      <th className="num" style={{ textAlign: 'right' }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        category={categoryLabel(categories, product.categoryId)}
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
            <PanelHead title="Topping" action={<Tag tone="muted">{toppings.length} topping</Tag>} />
            {toppingsFailed ? (
              <div className="panel-body">
                <Notice tone="warning">Không tải được danh sách topping.</Notice>
              </div>
            ) : toppings.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Chưa có topping">Topping sẽ xuất hiện khi được tạo.</EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th>Topping</th>
                      <th className="num">Giá</th>
                      <th>Bán</th>
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
