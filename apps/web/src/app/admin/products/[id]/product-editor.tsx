'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import type { MockCategory, MockProduct, MockProductSize, MockTopping } from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { replaceSizesSchema, updateProductSchema } from '@/lib/zod-schemas';
import { LocalizedInput } from '@/components/ui/localized-input';
import {
  clearProductImageAction,
  replaceProductSizesAction,
  replaceProductToppingsAction,
  saveProductAction,
  toggleProductDeleteAction,
  uploadProductImageAction,
} from '../actions';

interface ProductEditorProps {
  initialProduct: MockProduct;
  categories: MockCategory[];
  allToppings: MockTopping[];
}

const ALL_SIZES: Array<{ code: 'S' | 'M' | 'L'; labelVi: string; labelEn: string }> = [
  { code: 'S', labelVi: 'S - Nhỏ', labelEn: 'S - Small' },
  { code: 'M', labelVi: 'M - Vừa', labelEn: 'M - Medium' },
  { code: 'L', labelVi: 'L - Lớn', labelEn: 'L - Large' },
];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function ProductEditor({ initialProduct, categories, allToppings }: ProductEditorProps) {
  const { tx, tText, money } = useLocale();
  const [product, setProduct] = useState<MockProduct>(initialProduct);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [savingInfo, setSavingInfo] = useState(false);
  const [savingSizes, setSavingSizes] = useState(false);
  const [savingToppings, setSavingToppings] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [clearingImage, setClearingImage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [togglingDelete, setTogglingDelete] = useState(false);

  function showMessage(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 3000);
  }

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('PRODUCT_NAME_TAKEN')) {
      return tx('Tên sản phẩm đã tồn tại trong hệ thống.', 'Product name is already taken.');
    }
    if (code.includes('CATEGORY_NOT_FOUND')) {
      return tx('Không tìm thấy danh mục đã chọn.', 'Category not found.');
    }
    if (code.includes('VERSION_CONFLICT')) {
      return tx('Dữ liệu sản phẩm vừa bị thay đổi ở thiết bị khác. Vui lòng tải lại trang.', 'Product data was updated elsewhere. Please reload.');
    }
    return code;
  }

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    if (savingInfo) return;
    const parsed = updateProductSchema.safeParse({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      basePriceVnd: product.basePriceVnd,
      sortOrder: product.sortOrder,
    });
    if (!parsed.success) {
      showMessage('error', parsed.error.issues[0]?.message ?? tx('Dữ liệu không hợp lệ', 'Invalid data'));
      return;
    }
    setSavingInfo(true);
    try {
      const res = await saveProductAction(product, false);
      if (res.ok) {
        showMessage(
          'success',
          tx('Đã lưu thông tin cơ bản của sản phẩm.', 'Saved product basic info.'),
        );
      } else {
        showMessage('error', getFriendlyError(res.code));
      }
    } finally {
      setSavingInfo(false);
    }
  }

  function toggleSize(sizeCode: 'S' | 'M' | 'L') {
    const exists = product.sizes.some((s) => s.size === sizeCode);
    if (exists && product.sizes.length <= 1) {
      showMessage(
        'error',
        tx('Sản phẩm bắt buộc phải có ít nhất 1 size!', 'Product must have at least 1 size!'),
      );
      return;
    }
    const nextSizes: MockProductSize[] = exists
      ? product.sizes.filter((s) => s.size !== sizeCode)
      : [...product.sizes, { size: sizeCode, priceDeltaVnd: sizeCode === 'L' ? 10000 : 6000 }];
    setProduct({ ...product, sizes: nextSizes });
  }

  function updateSizeDelta(sizeCode: 'S' | 'M' | 'L', delta: number) {
    setProduct({
      ...product,
      sizes: product.sizes.map((s) => (s.size === sizeCode ? { ...s, priceDeltaVnd: delta } : s)),
    });
  }

  async function handleSaveSizes() {
    if (savingSizes) return;
    const parsed = replaceSizesSchema.safeParse({ sizes: product.sizes });
    if (!parsed.success) {
      showMessage('error', parsed.error.issues[0]?.message ?? tx('Cấu hình Size không hợp lệ', 'Invalid sizes'));
      return;
    }
    setSavingSizes(true);
    try {
      const res = await replaceProductSizesAction(product.id, parsed.data);
      if (res.ok) {
        showMessage('success', tx('Đã lưu cấu hình Size.', 'Saved sizes.'));
      } else {
        showMessage('error', res.code ?? tx('Không thể lưu Size.', 'Failed to save sizes.'));
      }
    } finally {
      setSavingSizes(false);
    }
  }

  function toggleToppingId(toppingId: string) {
    const has = product.toppingIds.includes(toppingId);
    const nextIds = has
      ? product.toppingIds.filter((id) => id !== toppingId)
      : [...product.toppingIds, toppingId];
    setProduct({ ...product, toppingIds: nextIds });
  }

  async function handleSaveToppings() {
    if (savingToppings) return;
    setSavingToppings(true);
    try {
      const res = await replaceProductToppingsAction(product.id, product.toppingIds);
      if (res.ok) {
        showMessage('success', tx('Đã lưu danh sách Topping.', 'Saved toppings.'));
      } else {
        showMessage('error', res.code ?? tx('Không thể lưu Topping.', 'Failed to save toppings.'));
      }
    } finally {
      setSavingToppings(false);
    }
  }

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploadingImage) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showMessage(
        'error',
        tx('Chỉ chấp nhận định dạng ảnh JPEG, PNG hoặc WebP!', 'Only JPEG, PNG, or WebP allowed!'),
      );
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showMessage(
        'error',
        tx('Dung lượng ảnh vượt quá tối đa 2 MB!', 'Image size exceeds 2 MB limit!'),
      );
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadProductImageAction(product.id, formData);
      if (res.ok && res.data) {
        const dataObj = res.data as { imageUrl?: string[] | string };
        const newUrl = Array.isArray(dataObj.imageUrl) ? dataObj.imageUrl[0] : dataObj.imageUrl;
        setProduct({ ...product, imageUrl: newUrl ?? URL.createObjectURL(file) });
        showMessage('success', tx(`Đã tải ảnh "${file.name}" lên thành công.`, `Uploaded "${file.name}" successfully.`));
      } else {
        showMessage('error', res.code ?? tx('Không thể tải ảnh lên.', 'Failed to upload image.'));
      }
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleClearImage() {
    if (clearingImage) return;
    setClearingImage(true);
    try {
      const res = await clearProductImageAction(product.id);
      if (res.ok) {
        setProduct({ ...product, imageUrl: null });
        showMessage('success', tx('Đã xóa ảnh.', 'Image removed.'));
      } else {
        showMessage('error', res.code ?? tx('Không thể xóa ảnh.', 'Failed to clear image.'));
      }
    } finally {
      setClearingImage(false);
    }
  }

  async function handleConfirmToggleDelete() {
    if (togglingDelete) return;
    const shouldRestore = Boolean(product.deletedAt);
    if (shouldRestore) {
      const cat = categories.find((c) => c.id === product.categoryId);
      if (cat?.deletedAt) {
        showMessage(
          'error',
          tx(
            `Không thể khôi phục vì danh mục "${cat.name.vi}" vẫn đang nằm trong thùng rác!`,
            `Cannot restore because category "${cat.name.en}" is still in trash!`,
          ),
        );
        setConfirmDelete(false);
        return;
      }
    }
    setTogglingDelete(true);
    try {
      const res = await toggleProductDeleteAction(product.id, shouldRestore);
      if (res.ok) {
        setProduct({
          ...product,
          deletedAt: shouldRestore ? null : new Date().toISOString(),
        });
        showMessage(
          'success',
          shouldRestore
            ? tx('Đã khôi phục sản phẩm.', 'Product restored.')
            : tx('Đã chuyển sản phẩm vào thùng rác.', 'Moved product to trash.'),
        );
        setConfirmDelete(false);
      } else {
        showMessage('error', res.code ?? tx('Không thể cập nhật trạng thái xóa.', 'Failed to toggle delete.'));
      }
    } finally {
      setTogglingDelete(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/products"
            prefetch={false}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#8C6A50] hover:text-[#4E311E] mb-1 transition-colors"
          >
            ← {tx('Quay lại danh sách Sản phẩm', 'Back to Products')}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#4E311E]">
              {tText(product.name)}
            </h1>
            {product.deletedAt && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#B83B2A] text-white text-xs font-bold">
                {tx('Thùng rác', 'In Trash')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/staff/inventory"
            prefetch={false}
            className="px-3.5 py-1.5 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-xs font-bold hover:bg-[#F3ECE1] transition-colors"
          >
            {tx('Chỉnh Tồn kho / Mở bán (Staff) →', 'Edit Stock / Availability →')}
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold text-white transition-colors ${
              product.deletedAt ? 'bg-[#2B5B6C] hover:bg-[#1E414D]' : 'bg-[#B83B2A] hover:bg-[#8F2D1F]'
            }`}
          >
            {product.deletedAt ? tx('Khôi phục món', 'Restore Item') : tx('Đưa vào thùng rác', 'Move to Trash')}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs font-bold text-white ${
            notice.type === 'error' ? 'bg-[#B83B2A]' : 'bg-[#1F5C32]'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <form
            onSubmit={handleSaveInfo}
            className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-5 space-y-4"
          >
            <h2 className="font-extrabold text-base text-[#4E311E]">
              1. {tx('Thông tin cơ bản', 'Basic Information')}
            </h2>
            <LocalizedInput
              label={tx('Tên sản phẩm', 'Product Name')}
              value={product.name}
              onChange={(name) => setProduct({ ...product, name })}
            />
            <LocalizedInput
              label={tx('Mô tả sản phẩm', 'Description')}
              value={product.description}
              onChange={(description) => setProduct({ ...product, description })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">{tx('Danh mục', 'Category')}</legend>
                <select
                  className="select select-bordered w-full bg-[#F3ECE1]"
                  value={product.categoryId}
                  onChange={(e) => setProduct({ ...product, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {tText(c.name)}
                    </option>
                  ))}
                </select>
              </fieldset>
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">{tx('Giá cơ bản (VNĐ)', 'Base Price (VND)')}</legend>
                <input
                  type="number"
                  step={1000}
                  min={0}
                  max={10000000}
                  className="input input-bordered w-full bg-[#F3ECE1]"
                  value={product.basePriceVnd}
                  onChange={(e) =>
                    setProduct({ ...product, basePriceVnd: Number(e.target.value) })
                  }
                />
              </fieldset>
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">{tx('Thứ tự hiển thị', 'Display Order')}</legend>
                <input
                  type="number"
                  min={0}
                  max={32767}
                  className="input input-bordered w-full bg-[#F3ECE1]"
                  value={product.sortOrder}
                  onChange={(e) =>
                    setProduct({ ...product, sortOrder: Number(e.target.value) })
                  }
                />
              </fieldset>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingInfo}
                className="px-5 py-2 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
              >
                {savingInfo ? '...' : tx('Lưu thông tin cơ bản', 'Save Info')}
              </button>
            </div>
          </form>

          <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base text-[#4E311E]">
                  2. {tx('Chọn Size & Giá cộng thêm', 'Sizes & Price Delta')}
                </h2>
                <p className="text-xs text-[#8C6A50]">
                  {tx('Bắt buộc có ít nhất 1 size', 'At least 1 size required')}
                </p>
              </div>
              <button
                type="button"
                disabled={savingSizes}
                onClick={handleSaveSizes}
                className="px-4 py-1.5 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
              >
                {savingSizes ? '...' : tx('Lưu Sizes', 'Save Sizes')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ALL_SIZES.map((item) => {
                const current = product.sizes.find((s) => s.size === item.code);
                return (
                  <div
                    key={item.code}
                    className={`rounded-2xl p-3.5 border transition-all ${
                      current
                        ? 'bg-[#F3ECE1] border-2 border-[#4E311E]'
                        : 'bg-[#FCF9F2] border-[#C9B29B] opacity-65'
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer mb-2">
                      <span className="font-extrabold text-sm text-[#4E311E]">
                        {tx(item.labelVi, item.labelEn)}
                      </span>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={Boolean(current)}
                        onChange={() => toggleSize(item.code)}
                      />
                    </label>
                    {current ? (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-[#B83B2A] block">
                          +{money(current.priceDeltaVnd)}
                        </span>
                        <input
                          type="number"
                          step={1000}
                          min={0}
                          max={10000000}
                          className="input input-bordered input-xs w-full bg-[#FCF9F2] font-mono"
                          value={current.priceDeltaVnd}
                          onChange={(e) => updateSizeDelta(item.code, Number(e.target.value))}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#8C6A50]">
                        {tx('Không áp dụng', 'Disabled')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base text-[#4E311E]">
                3. {tx('Topping được phép đi kèm', 'Allowed Toppings')}
              </h2>
              <button
                type="button"
                disabled={savingToppings}
                onClick={handleSaveToppings}
                className="px-4 py-1.5 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] disabled:opacity-50 transition-colors"
              >
                {savingToppings ? '...' : tx('Lưu Toppings', 'Save Toppings')}
              </button>
            </div>

            <div className="space-y-2.5">
              {allToppings
                .filter((t) => !t.deletedAt)
                .map((top) => {
                  const checked = product.toppingIds.includes(top.id);
                  return (
                    <label
                      key={top.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border cursor-pointer transition-all ${
                        checked
                          ? 'bg-[#F3ECE1] border-[1.5px] border-[#4E311E]'
                          : 'bg-[#FCF9F2] border-[#C9B29B]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={checked}
                          onChange={() => toggleToppingId(top.id)}
                        />
                        <span className="font-bold text-sm text-[#4E311E]">{tText(top.name)}</span>
                      </div>
                      <span className="text-xs font-extrabold text-[#B83B2A]">
                        +{money(top.priceVnd)}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-5 space-y-4">
            <h2 className="font-extrabold text-base text-[#4E311E]">
              4. {tx('Ảnh sản phẩm', 'Product Image')}
            </h2>
            <p className="text-xs text-[#8C6A50]">
              {tx('Tối đa 2 MB · JPEG, PNG, WebP', 'Max 2 MB · JPEG, PNG, WebP')}
            </p>
            <div className="aspect-square rounded-3xl bg-[#E8C8A9] border border-[#B59478] flex items-center justify-center overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={tText(product.name)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-1">
                  <div className="text-5xl">🧋</div>
                  <span className="text-xs font-bold text-[#4E311E]">
                    {tx('Chưa có ảnh', 'No image')}
                  </span>
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingImage}
              className="file-input file-input-bordered file-input-sm w-full rounded-full bg-[#F3ECE1]"
              onChange={handleImageSelect}
            />

            {uploadingImage && (
              <p className="text-xs text-[#4E311E] font-bold text-center">
                {tx('Đang tải ảnh lên...', 'Uploading image...')}
              </p>
            )}

            {product.imageUrl && (
              <button
                type="button"
                disabled={clearingImage}
                className="w-full py-2 rounded-full bg-[#B83B2A] text-white text-xs font-bold hover:bg-[#8F2D1F] disabled:opacity-50 transition-colors"
                onClick={handleClearImage}
              >
                {clearingImage ? '...' : tx('Xóa ảnh hiện tại', 'Remove Current Image')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Xác nhận Đưa vào thùng rác / Khôi phục */}
      {confirmDelete && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {product.deletedAt
                ? tx('Xác nhận khôi phục Sản phẩm?', 'Confirm restore product?')
                : tx('Xác nhận đưa Sản phẩm vào thùng rác?', 'Move product to trash?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {product.deletedAt
                ? tx(
                    `Sản phẩm "${tText(product.name)}" sẽ được mở bán và hiển thị lại trong thực đơn.`,
                    `Product "${tText(product.name)}" will be restored to menu.`,
                  )
                : tx(
                    `Sản phẩm "${tText(product.name)}" sẽ được chuyển vào mục Thùng rác. Bạn có thể khôi phục lại bất kỳ lúc nào.`,
                    `Product "${tText(product.name)}" will be moved to trash. You can restore it anytime.`,
                  )}
            </p>
            <div className="modal-action">
              <button
                type="button"
                disabled={togglingDelete}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold"
                onClick={() => setConfirmDelete(false)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={togglingDelete}
                onClick={handleConfirmToggleDelete}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold disabled:opacity-50 ${
                  product.deletedAt ? 'bg-[#2B5B6C]' : 'bg-[#B83B2A]'
                }`}
              >
                {togglingDelete
                  ? '...'
                  : product.deletedAt
                    ? tx('Xác nhận Khôi phục', 'Confirm Restore')
                    : tx('Đưa vào thùng rác', 'Move to Trash')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}