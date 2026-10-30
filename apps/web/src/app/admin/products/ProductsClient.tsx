'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import type {
  AdminCategoryResponseDto,
  AdminProductListItemResponseDto,
  AdminProductResponseDto,
  AdminToppingResponseDto,
} from '@brewlite/api-client';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useConsoleCopy } from '@/i18n/console-context';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { formatDay, nullableText } from '@/lib/admin-format';
import {
  createProductAction,
  deleteProductAction,
  getProductAction,
  restoreProductAction,
  updateProductAction,
  uploadProductImageAction,
} from '@/lib/admin-actions';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import ProductImageControl from './ProductImageControl';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type SizeKey = 'S' | 'M' | 'L';
type SizeState = Record<SizeKey, { enabled: boolean; delta: string }>;

const SIZE_KEYS: SizeKey[] = ['S', 'M', 'L'];
const STOCK_MAX = 2_147_483_647;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function emptySizes(): SizeState {
  return {
    S: { enabled: true, delta: '0' },
    M: { enabled: false, delta: '6000' },
    L: { enabled: false, delta: '10000' },
  };
}

function failureMessage(result: Failure, locale: Locale): string {
  return describeError(result.code, result.details as ApiErrorDetails, locale);
}

function ProductStatus({ product }: { product: AdminProductListItemResponseDto }) {
  const { t } = useConsoleCopy();
  if (nullableText(product.deletedAt)) return <Tag tone="error">{t('Đã xóa', 'Deleted')}</Tag>;
  if (!product.isAvailable) return <Tag tone="warning">{t('Tạm ngừng', 'Paused')}</Tag>;
  return <Tag tone="success">{t('Đang bán', 'On sale')}</Tag>;
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
  editId,
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
  editId: string;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const autoEditRef = useRef(false);
  const { showToast } = useToast();

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      return null;
    });
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const pickImage = (file: File) => {
    setImageError(null);
    if (!IMAGE_TYPES.has(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setImageError(
        t(
          `Ảnh phải là JPEG, PNG hoặc WebP và không quá ${Math.round(
            PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024),
          )} MB.`,
          `The image must be JPEG, PNG or WebP and no larger than ${Math.round(
            PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024),
          )} MB.`,
        ),
      );
      return;
    }
    setImageFile(file);
    setImagePreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };

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
    clearImage();
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

  const openEdit = async (product: { id: string }) => {
    setLoadingId(product.id);
    setError(null);
    try {
      const result = await runAction(getProductAction(product.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      fillForm(result.data);
      setEditTarget(result.data);
    } finally {
      setLoadingId(null);
    }
  };

  // The product detail page deep-links here with `?edit=<id>`; open that record once.
  useEffect(() => {
    if (!editId || autoEditRef.current) return;
    autoEditRef.current = true;
    void openEdit({ id: editId });
  }, [editId]);

  const afterWrite = (message?: string) => {
    setCreateOpen(false);
    setEditTarget(null);
    setDeleteTarget(null);
    setError(null);
    if (message) showToast(message);
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
    try {
      const result = await runAction(
        createProductAction({
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
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      if (imageFile) {
        const formData = new FormData();
        formData.set('productId', result.data.id);
        formData.set('file', imageFile);
        const upload = await runAction(uploadProductImageAction(formData));
        if (!upload.ok) {
          showToast(
            t(
              `Đã tạo ${nameVi} nhưng chưa tải được ảnh: ${describeError(
                upload.code,
                upload.details,
                locale,
              )}`,
              `${nameVi} was created but the image could not be uploaded: ${describeError(
                upload.code,
                upload.details,
                locale,
              )}`,
            ),
            { tone: 'error', duration: 9000 },
          );
        } else {
          showToast(t(`Đã tạo ${nameVi} kèm ảnh sản phẩm.`, `${nameVi} created with an image.`));
        }
      } else {
        showToast(t(`Đã tạo ${nameVi}.`, `${nameVi} created.`));
      }
      resetForm();
      afterWrite();
    } finally {
      setBusy(null);
    }
  };

  const submitEdit = async () => {
    if (!editTarget || baseInvalid || sortInvalid || sizesInvalid || descriptionPartial) return;
    setBusy('edit');
    setError(null);
    try {
      const result = await runAction(
        updateProductAction({
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
        }),
      );
      if (!result.ok) {
        if (result.details.partial === true) {
          setError(
            t(
              'Thông tin cơ bản đã lưu, nhưng size/topping chưa cập nhật. Kiểm tra lại rồi lưu lần nữa.',
              'The core details were saved, but sizes/toppings did not update. Review and save again.',
            ),
          );
          const fresh = await runAction(getProductAction(editTarget.id));
          if (fresh.ok) fillForm(fresh.data);
          router.refresh();
          return;
        }
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã lưu thay đổi.', 'Changes saved.'));
    } finally {
      setBusy(null);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    try {
      const result = await runAction(deleteProductAction(deleteTarget.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã xóa mềm sản phẩm.', 'Product soft-deleted.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (product: AdminProductListItemResponseDto) => {
    setBusy(product.id);
    setError(null);
    try {
      const result = await runAction(restoreProductAction(product.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã khôi phục sản phẩm.', 'Product restored.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
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
        title={t('Sản phẩm', 'Products')}
        meta={t(`${total ?? rows.length} sản phẩm`, `${total ?? rows.length} products`)}
        lede={t(
          'Tạo món mới, sửa giá và mô tả, chọn size và topping được phép. Tồn kho thao tác nhanh ở Kho & món.',
          'Create drinks, edit prices and descriptions, choose allowed sizes and toppings. Manage stock in Stock & menu.',
        )}
        actions={<Button onClick={openCreate}>{t('Thêm sản phẩm', 'Add product')}</Button>}
      />

      {error && !modalOpen && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/products" method="get">
          <div className="field">
            <label htmlFor="product-q">{t('Tìm theo tên', 'Search by name')}</label>
            <input
              id="product-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="latte"
            />
          </div>
          <div className="field">
            <label htmlFor="product-category">{t('Danh mục', 'Category')}</label>
            <select
              id="product-category"
              className="input"
              name="categoryId"
              defaultValue={categoryId}
            >
              <option value="">{t('Tất cả', 'All')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name[locale]}
                </option>
              ))}
            </select>
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              {t('Chỉ món đã xóa', 'Deleted products only')}
              <small>
                {t(
                  'Bật để khôi phục món đã xóa mềm.',
                  'Use this to restore soft-deleted products.',
                )}
              </small>
            </span>
          </label>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {(query || categoryId || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/products">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={
                deletedOnly
                  ? t('Không có món đã xóa', 'No deleted products')
                  : t('Chưa có sản phẩm', 'No products yet')
              }
            >
              {deletedOnly
                ? t(
                    'Không có sản phẩm nào bị xóa mềm khớp bộ lọc.',
                    'No soft-deleted product matches the filter.',
                  )
                : t(
                    'Thêm sản phẩm đầu tiên để bắt đầu bán.',
                    'Add the first product to start selling.',
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>{t('Sản phẩm', 'Product')}</th>
                  <th>{t('Ảnh', 'Image')}</th>
                  <th>{t('Nhóm', 'Category')}</th>
                  <th className="num">{t('Giá gốc', 'Base price')}</th>
                  <th>{t('Kho', 'Stock')}</th>
                  <th>{t('Trạng thái', 'Status')}</th>
                  <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const deleted = Boolean(nullableText(product.deletedAt));
                  return (
                    <tr key={product.id}>
                      <td data-label={t('Sản phẩm', 'Product')}>
                        <span className="cell-title">{product.name.vi}</span>
                        <span className="cell-meta">{product.name.en}</span>
                      </td>
                      <td data-label={t('Ảnh', 'Image')}>
                        <ProductImageControl
                          productId={product.id}
                          productName={product.name.vi}
                          imageUrl={product.imageUrl}
                        />
                      </td>
                      <td data-label={t('Nhóm', 'Category')}>{product.categoryName[locale]}</td>
                      <td data-label={t('Giá gốc', 'Base price')} className="num">
                        {formatVnd(product.basePriceVnd, locale)}
                      </td>
                      <td data-label={t('Kho', 'Stock')}>
                        {product.stockQty === null ? (
                          <span className="muted">{t('Không theo dõi', 'Not tracked')}</span>
                        ) : (
                          product.stockQty
                        )}
                      </td>
                      <td data-label={t('Trạng thái', 'Status')}>
                        <ProductStatus product={product} />
                      </td>
                      <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                        <Link className="text-link" href={`/admin/products/${product.id}`}>
                          {t('Chi tiết', 'Details')}
                        </Link>
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(product)}
                          >
                            {busy === product.id
                              ? t('Đang khôi phục…', 'Restoring…')
                              : t('Khôi phục', 'Restore')}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || loadingId !== null}
                              onClick={() => void openEdit(product)}
                            >
                              {loadingId === product.id
                                ? t('Đang tải…', 'Loading…')
                                : t('Sửa', 'Edit')}
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
                              {t('Xóa', 'Delete')}
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
            label={t('sản phẩm', 'products')}
            note={t('sắp theo thứ tự menu', 'sorted by menu order')}
            query={queryString}
          />
        )}
      </Panel>

      {modalOpen && (
        <Modal
          title={
            editTarget
              ? t(`Sửa sản phẩm · ${editTarget.name.vi}`, `Edit product · ${editTarget.name.vi}`)
              : t('Thêm sản phẩm', 'Add product')
          }
          meta={
            editTarget
              ? t(
                  `Tạo lúc ${formatDay(editTarget.createdAt, locale)}`,
                  `Created ${formatDay(editTarget.createdAt, locale)}`,
                )
              : t(
                  'Món mới sẽ hiện ngay trên menu khi đang bán.',
                  'A new product appears on the menu as soon as it is on sale.',
                )
          }
          wide
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
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
                {busy
                  ? t('Đang lưu…', 'Saving…')
                  : editTarget
                    ? t('Lưu thay đổi', 'Save changes')
                    : t('Thêm sản phẩm', 'Add product')}
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
              <label htmlFor="product-form-category">{t('Danh mục', 'Category')}</label>
              <select
                id="product-form-category"
                className="input"
                value={formCategory}
                onChange={(event) => setFormCategory(event.target.value)}
              >
                <option value="">{t('Chọn danh mục', 'Choose a category')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name[locale]}
                    {category.isActive ? '' : t(' (tạm ẩn)', ' (hidden)')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-form-base">{t('Giá gốc (VND)', 'Base price (VND)')}</label>
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
                {formatVnd(Number.isFinite(parsedBase) ? parsedBase : 0, locale)} ·{' '}
                {t('size cộng thêm tính riêng.', 'size surcharges are added separately.')}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-form-vi">{t('Tên tiếng Việt', 'Vietnamese name')}</label>
              <input
                id="product-form-vi"
                className="input"
                value={nameVi}
                maxLength={100}
                onChange={(event) => setNameVi(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-form-en">{t('Tên tiếng Anh', 'English name')}</label>
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
              <label htmlFor="product-form-desc-vi">
                {t('Mô tả tiếng Việt', 'Vietnamese description')}
              </label>
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
              <label htmlFor="product-form-desc-en">
                {t('Mô tả tiếng Anh', 'English description')}
              </label>
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
              {t(
                'Mô tả phải có đủ cả hai ngôn ngữ, hoặc để trống cả hai.',
                'Provide the description in both languages, or leave both empty.',
              )}
            </p>
          )}

          {!editTarget && (
            <div className="field">
              <label htmlFor="product-form-image">
                {t('Ảnh sản phẩm (không bắt buộc)', 'Product image (optional)')}
              </label>
              <div className="image-picker">
                <div className="image-picker-preview">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt={t(
                        `Ảnh xem trước ${nameVi || 'sản phẩm mới'}`,
                        `Preview of ${nameVi || 'the new product'}`,
                      )}
                      width={72}
                      height={72}
                      unoptimized
                    />
                  ) : (
                    <span>{t('Chưa chọn', 'None selected')}</span>
                  )}
                </div>
                <div className="image-picker-actions">
                  <input
                    ref={imageInputRef}
                    id="product-form-image"
                    className="input"
                    type="file"
                    accept={IMAGE_ACCEPT}
                    disabled={busy !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) pickImage(file);
                    }}
                  />
                  {imagePreview && (
                    <Button size="sm" variant="quiet" disabled={busy !== null} onClick={clearImage}>
                      {t('Bỏ ảnh', 'Remove image')}
                    </Button>
                  )}
                </div>
              </div>
              <p className="field-hint">
                {t(
                  `JPEG, PNG hoặc WebP, tối đa ${Math.round(
                    PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024),
                  )} MB. Ảnh được tải lên ngay sau khi tạo sản phẩm.`,
                  `JPEG, PNG or WebP, up to ${Math.round(
                    PRODUCT_IMAGE_MAX_BYTES / (1024 * 1024),
                  )} MB. The image uploads right after the product is created.`,
                )}
              </p>
              {imageError && (
                <p className="field-hint" role="alert" style={{ color: 'var(--color-error)' }}>
                  {imageError}
                </p>
              )}
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label htmlFor="product-form-sort">{t('Thứ tự trong menu', 'Menu order')}</label>
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
              <label htmlFor="product-form-stock">{t('Tồn kho ban đầu', 'Initial stock')}</label>
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
                  ? t(
                      'Sửa tồn kho ở Kho & món để tránh ghi đè.',
                      'Change stock in Stock & menu to avoid overwriting it.',
                    )
                  : t('Để trống nếu không theo dõi kho.', 'Leave empty to stop tracking stock.')}
              </p>
            </div>
          </div>

          <div className="form-section">
            <h2>{t('Size được bán', 'Sizes sold')}</h2>
            <p className="field-hint" style={{ marginBottom: 'var(--space-sm)' }}>
              {t(
                'Chọn ít nhất một size. Giá hiển thị = giá gốc + phụ thu size.',
                'Choose at least one size. Display price = base price + size surcharge.',
              )}
            </p>
            <table className="size-table">
              <thead>
                <tr>
                  <th>{t('Dùng', 'Use')}</th>
                  <th>Size</th>
                  <th>{t('Phụ thu (VND)', 'Surcharge (VND)')}</th>
                  <th>{t('Giá bán', 'Sale price')}</th>
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
                          aria-label={t(`Bán size ${key}`, `Sell size ${key}`)}
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
                          aria-label={t(`Phụ thu size ${key}`, `Surcharge for size ${key}`)}
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
                          ? formatVnd(price, locale)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="form-section">
            <h2>{t('Topping được phép', 'Allowed toppings')}</h2>
            <p className="field-hint" style={{ marginBottom: 'var(--space-sm)' }}>
              {t(
                'Không chọn topping nào nếu món không nhận topping.',
                'Choose none if the product does not accept toppings.',
              )}
            </p>
            {toppings.length === 0 ? (
              <p className="muted">
                {t('Chưa có topping trong hệ thống.', 'No toppings exist yet.')}
              </p>
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
                      {topping.name[locale]}
                      <small>
                        {formatVnd(topping.priceVnd, locale)}
                        {topping.isAvailable ? '' : t(' · tạm hết', ' · sold out')}
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
          title={t(
            `Xóa sản phẩm · ${deleteTarget.name.vi}`,
            `Delete product · ${deleteTarget.name.vi}`,
          )}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Giữ lại', 'Keep')}
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? t('Đang xóa…', 'Deleting…') : t('Xóa mềm', 'Soft delete')}
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
            {t(
              'Món sẽ biến mất khỏi menu khách. Có thể khôi phục ở bộ lọc “Chỉ món đã xóa”.',
              'The product disappears from the customer menu. Restore it with the “Deleted products only” filter.',
            )}
          </Notice>
        </Modal>
      )}
    </>
  );
}
