'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AdminCategoryResponseDto,
  AdminProductListItemResponseDto,
  AdminProductResponseDto,
  AdminToppingResponseDto,
} from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatVnd } from '@/i18n/format';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createProductAction,
  deleteProductAction,
  getProductAction,
  restoreProductAction,
  updateProductAction,
} from '@/lib/admin-actions';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import ProductImageControl from './ProductImageControl';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type SizeKey = 'S' | 'M' | 'L';
type SizeState = Record<SizeKey, { enabled: boolean; delta: string }>;

const SIZE_KEYS: SizeKey[] = ['S', 'M', 'L'];
const STOCK_MAX = 2_147_483_647;

function emptySizes(): SizeState {
  return {
    S: { enabled: true, delta: '0' },
    M: { enabled: false, delta: '6000' },
    L: { enabled: false, delta: '10000' },
  };
}

function failureMessage(result: Failure): string {
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
}

function ProductStatus({ product }: { product: AdminProductListItemResponseDto }) {
  if (nullableText(product.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (!product.isAvailable) return <Tag tone="warning">Tạm ngừng</Tag>;
  return <Tag tone="success">Đang bán</Tag>;
}

export default function ProductsClient({
  rows,
  total,
  pageNumber,
  categories,
  toppings,
  deletedOnly,
  query,
  categoryId,
  queryString,
}: {
  rows: AdminProductListItemResponseDto[];
  total: number | null;
  pageNumber: number;
  categories: AdminCategoryResponseDto[];
  toppings: AdminToppingResponseDto[];
  deletedOnly: boolean;
  query: string;
  categoryId: string;
  queryString: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminProductResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProductListItemResponseDto | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formCategory, setFormCategory] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionVi, setDescriptionVi] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [basePrice, setBasePrice] = useState('0');
  const [stockQty, setStockQty] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [sizes, setSizes] = useState<SizeState>(emptySizes);
  const [toppingIds, setToppingIds] = useState<string[]>([]);

  const close = () => {
    if (busy) return;
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
  };

  const resetForm = () => {
    setFormCategory('');
    setNameVi('');
    setNameEn('');
    setDescriptionVi('');
    setDescriptionEn('');
    setBasePrice('0');
    setStockQty('');
    setSortOrder('');
    setSizes(emptySizes());
    setToppingIds([]);
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const fillForm = (product: AdminProductResponseDto) => {
    setFormCategory(product.categoryId);
    setNameVi(product.name.vi);
    setNameEn(product.name.en);
    setDescriptionVi(product.description?.vi ?? '');
    setDescriptionEn(product.description?.en ?? '');
    setBasePrice(String(product.basePriceVnd));
    setStockQty(product.stockQty === null ? '' : String(product.stockQty));
    setSortOrder(String(product.sortOrder));
    const next = emptySizes();
    for (const key of SIZE_KEYS) next[key] = { enabled: false, delta: next[key].delta };
    for (const size of product.sizes) {
      next[size.size] = { enabled: true, delta: String(size.priceDeltaVnd) };
    }
    setSizes(next);
    setToppingIds(product.toppingIds);
    setError(null);
  };

  const openEdit = async (product: AdminProductListItemResponseDto) => {
    setLoadingId(product.id);
    setError(null);
    const result = await getProductAction(product.id);
    setLoadingId(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    fillForm(result.data);
    setEditTarget(result.data);
  };

  const afterWrite = () => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    router.refresh();
  };

  const parsedBase = Number(basePrice);
  const baseInvalid =
    basePrice.trim() === '' ||
    !Number.isInteger(parsedBase) ||
    parsedBase < 0 ||
    parsedBase > 10_000_000;
  const parsedStock = stockQty.trim() === '' ? null : Number(stockQty);
  const stockInvalid =
    parsedStock !== null &&
    (!Number.isInteger(parsedStock) || parsedStock < 0 || parsedStock > STOCK_MAX);
  const parsedSort = sortOrder.trim() === '' ? undefined : Number(sortOrder);
  const sortInvalid =
    parsedSort !== undefined &&
    (!Number.isInteger(parsedSort) || parsedSort < 0 || parsedSort > 32767);
  const selectedSizes = SIZE_KEYS.filter((key) => sizes[key].enabled);
  const sizesInvalid = selectedSizes.some((key) => {
    const value = Number(sizes[key].delta);
    return !Number.isInteger(value) || value < 0 || value > 10_000_000;
  });
  const descriptionPartial =
    (descriptionVi.trim().length === 0) !== (descriptionEn.trim().length === 0);

  const buildSizes = () =>
    selectedSizes.map((key) => ({ size: key, priceDeltaVnd: Number(sizes[key].delta) }));

  const submitCreate = async () => {
    if (baseInvalid || stockInvalid || sortInvalid || sizesInvalid || descriptionPartial) return;
    setBusy('create');
    setError(null);
    const result = await createProductAction({
      categoryId: formCategory,
      name: { vi: nameVi, en: nameEn },
      description:
        descriptionVi.trim().length > 0 && descriptionEn.trim().length > 0
          ? { vi: descriptionVi, en: descriptionEn }
          : undefined,
      basePriceVnd: parsedBase,
      sizes: buildSizes(),
      toppingIds,
      stockQty: parsedStock,
      sortOrder: parsedSort,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    resetForm();
    afterWrite();
  };

  const submitEdit = async () => {
    if (!editTarget || baseInvalid || sortInvalid || sizesInvalid || descriptionPartial) return;
    setBusy('edit');
    setError(null);
    const result = await updateProductAction({
      productId: editTarget.id,
      categoryId: formCategory,
      name: { vi: nameVi, en: nameEn },
      description:
        descriptionVi.trim().length > 0 && descriptionEn.trim().length > 0
          ? { vi: descriptionVi, en: descriptionEn }
          : null,
      basePriceVnd: parsedBase,
      sizes: buildSizes(),
      toppingIds,
      sortOrder: parsedSort,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    const result = await deleteProductAction(deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const restore = async (product: AdminProductListItemResponseDto) => {
    setBusy(product.id);
    setError(null);
    const result = await restoreProductAction(product.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    router.refresh();
  };

  const toggleSize = (key: SizeKey) => {
    setSizes((current) => ({
      ...current,
      [key]: { ...current[key], enabled: !current[key].enabled },
    }));
  };

  const toggleTopping = (id: string) => {
    setToppingIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const modalOpen = createOpen || editTarget !== null;

  return (
    <>
      <PageHead
        title="Sản phẩm"
        meta={`${total ?? rows.length} sản phẩm`}
        lede="Tạo món mới, sửa giá và mô tả, chọn size và topping được phép. Tồn kho thao tác nhanh ở Kho & món."
        actions={<Button onClick={openCreate}>Thêm sản phẩm</Button>}
      />

      {error && !modalOpen && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/products" method="get">
          <div className="field">
            <label htmlFor="product-q">Tìm theo tên</label>
            <input
              id="product-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="Ví dụ: latte"
            />
          </div>
          <div className="field">
            <label htmlFor="product-category">Danh mục</label>
            <select
              id="product-category"
              className="input"
              name="categoryId"
              defaultValue={categoryId}
            >
              <option value="">Tất cả</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name.vi}
                </option>
              ))}
            </select>
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              Chỉ món đã xóa
              <small>Bật để khôi phục món đã xóa mềm.</small>
            </span>
          </label>
          <Button type="submit">Lọc</Button>
          {(query || categoryId || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/products">
              Xóa lọc
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState title={deletedOnly ? 'Không có món đã xóa' : 'Chưa có sản phẩm'}>
              {deletedOnly
                ? 'Không có sản phẩm nào bị xóa mềm khớp bộ lọc.'
                : 'Thêm sản phẩm đầu tiên để bắt đầu bán.'}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Ảnh</th>
                  <th>Nhóm</th>
                  <th className="num">Giá gốc</th>
                  <th>Kho</th>
                  <th>Trạng thái</th>
                  <th className="cell-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const deleted = Boolean(nullableText(product.deletedAt));
                  return (
                    <tr key={product.id}>
                      <td data-label="Sản phẩm">
                        <span className="cell-title">{product.name.vi}</span>
                        <span className="cell-meta">{product.name.en}</span>
                      </td>
                      <td data-label="Ảnh">
                        <ProductImageControl
                          productId={product.id}
                          productName={product.name.vi}
                          imageUrl={product.imageUrl}
                        />
                      </td>
                      <td data-label="Nhóm">{product.categoryName.vi}</td>
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
                      <td className="cell-actions" data-label="Thao tác">
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(product)}
                          >
                            {busy === product.id ? 'Đang khôi phục…' : 'Khôi phục'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || loadingId !== null}
                              onClick={() => void openEdit(product)}
                            >
                              {loadingId === product.id ? 'Đang tải…' : 'Sửa'}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null}
                              onClick={() => {
                                setError(null);
                                setDeleteTarget(product);
                              }}
                            >
                              Xóa
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            query={queryString}
          />
        )}
      </Panel>

      {modalOpen && (
        <Modal
          title={editTarget ? `Sửa sản phẩm · ${editTarget.name.vi}` : 'Thêm sản phẩm'}
          meta={
            editTarget
              ? `Tạo lúc ${formatDay(editTarget.createdAt)}`
              : 'Món mới sẽ hiện ngay trên menu khi đang bán.'
          }
          wide
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
              </Button>
              <Button
                disabled={
                  busy !== null ||
                  formCategory.length === 0 ||
                  nameVi.trim().length === 0 ||
                  nameEn.trim().length === 0 ||
                  baseInvalid ||
                  stockInvalid ||
                  sortInvalid ||
                  sizesInvalid ||
                  selectedSizes.length === 0 ||
                  descriptionPartial
                }
                onClick={() => void (editTarget ? submitEdit() : submitCreate())}
              >
                {busy ? 'Đang lưu…' : editTarget ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-form-category">Danh mục</label>
              <select
                id="product-form-category"
                className="input"
                value={formCategory}
                onChange={(event) => setFormCategory(event.target.value)}
              >
                <option value="">Chọn danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name.vi}
                    {category.isActive ? '' : ' (tạm ẩn)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-form-base">Giá gốc (VND)</label>
              <input
                id="product-form-base"
                className="input"
                type="number"
                min={0}
                max={10000000}
                step={1000}
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
              />
              <p className="field-hint">
                {formatVnd(Number.isFinite(parsedBase) ? parsedBase : 0, 'vi')} · size cộng thêm
                tính riêng.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-form-vi">Tên tiếng Việt</label>
              <input
                id="product-form-vi"
                className="input"
                value={nameVi}
                maxLength={100}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-form-en">Tên tiếng Anh</label>
              <input
                id="product-form-en"
                className="input"
                value={nameEn}
                maxLength={100}
                onChange={(event) => setNameEn(event.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-form-desc-vi">Mô tả tiếng Việt</label>
              <textarea
                id="product-form-desc-vi"
                className="input"
                rows={2}
                maxLength={500}
                value={descriptionVi}
                onChange={(event) => setDescriptionVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-form-desc-en">Mô tả tiếng Anh</label>
              <textarea
                id="product-form-desc-en"
                className="input"
                rows={2}
                maxLength={500}
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
              />
            </div>
          </div>
          {descriptionPartial && (
            <p className="field-hint" style={{ color: 'var(--color-error)' }}>
              Mô tả phải có đủ cả hai ngôn ngữ, hoặc để trống cả hai.
            </p>
          )}

          <div className="field-row">
            <div className="field">
              <label htmlFor="product-form-sort">Thứ tự trong menu</label>
              <input
                id="product-form-sort"
                className="input"
                type="number"
                min={0}
                max={32767}
                step={1}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-form-stock">Tồn kho ban đầu</label>
              <input
                id="product-form-stock"
                className="input"
                type="number"
                min={0}
                step={1}
                value={stockQty}
                disabled={editTarget !== null}
                onChange={(event) => setStockQty(event.target.value)}
              />
              <p className="field-hint">
                {editTarget
                  ? 'Sửa tồn kho ở Kho & món để tránh ghi đè.'
                  : 'Để trống nếu không theo dõi kho.'}
              </p>
            </div>
          </div>

          <div className="form-section">
            <h2>Size được bán</h2>
            <p className="field-hint" style={{ marginBottom: 'var(--space-sm)' }}>
              Chọn ít nhất một size. Giá hiển thị = giá gốc + phụ thu size.
            </p>
            <table className="size-table">
              <thead>
                <tr>
                  <th>Dùng</th>
                  <th>Size</th>
                  <th>Phụ thu (VND)</th>
                  <th>Giá bán</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_KEYS.map((key) => {
                  const delta = Number(sizes[key].delta);
                  const price = parsedBase + (Number.isFinite(delta) ? delta : 0);
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={sizes[key].enabled}
                          aria-label={`Bán size ${key}`}
                          onChange={() => toggleSize(key)}
                        />
                      </td>
                      <td>
                        <strong>{key}</strong>
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={10000000}
                          step={1000}
                          value={sizes[key].delta}
                          disabled={!sizes[key].enabled}
                          aria-label={`Phụ thu size ${key}`}
                          onChange={(event) =>
                            setSizes((current) => ({
                              ...current,
                              [key]: { ...current[key], delta: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="num">
                        {sizes[key].enabled && Number.isFinite(price)
                          ? formatVnd(price, 'vi')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="form-section">
            <h2>Topping được phép</h2>
            <p className="field-hint" style={{ marginBottom: 'var(--space-sm)' }}>
              Không chọn topping nào nếu món không nhận topping.
            </p>
            {toppings.length === 0 ? (
              <p className="muted">Chưa có topping trong hệ thống.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 'var(--space-2xs)',
                }}
              >
                {toppings.map((topping) => (
                  <label className="check" key={topping.id}>
                    <input
                      type="checkbox"
                      checked={toppingIds.includes(topping.id)}
                      onChange={() => toggleTopping(topping.id)}
                    />
                    <span>
                      {topping.name.vi}
                      <small>
                        {formatVnd(topping.priceVnd, 'vi')}
                        {topping.isAvailable ? '' : ' · tạm hết'}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Xóa sản phẩm · ${deleteTarget.name.vi}`}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Giữ lại
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? 'Đang xóa…' : 'Xóa mềm'}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <Notice tone="warning">
            Món sẽ biến mất khỏi menu khách. Có thể khôi phục ở bộ lọc “Chỉ món đã xóa”.
          </Notice>
        </Modal>
      )}
    </>
  );
}
