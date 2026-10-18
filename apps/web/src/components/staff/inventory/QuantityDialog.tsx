'use client';
import { useStaffI18n } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { inventoryError, isProductAvailable } from './inventory-api';
import type { InventoryProduct } from './inventory-api';
type AvailabilityValue = 'available' | 'unavailable';
export function QuantityDialog({
  product,
  onSave,
  onClose,
  disabled = false,
}: {
  product: InventoryProduct;
  onSave: (product: InventoryProduct, quantity: number | null, available: boolean) => Promise<void>;
  onClose: () => void;
  disabled?: boolean;
}) {
  const { t, name, number } = useStaffI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [quantity, setQuantity] = useState(product.stockQty?.toString() ?? '');
  const [available, setAvailable] = useState(isProductAvailable(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const soldOut = quantity.trim() !== '' && Number(quantity) === 0;
  const validQuantity =
    quantity.trim() === ''
      ? product.stockQty === null
      : Number.isInteger(Number(quantity)) &&
        Number(quantity) >= 0 &&
        Number(quantity) <= 2147483647;
  const effectiveAvailable = available && !soldOut;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      if (element?.open) element.close();
      previous?.focus();
    };
  }, []);
  const handleAvailabilityChange = (value: AvailabilityValue) => {
    if (soldOut || !validQuantity || submitting.current || disabled) return;
    setAvailable(value === 'available');
  };
  const handleClose = () => {
    if (submitting.current) return;
    onClose();
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || disabled) return;
    const trimmedQuantity = quantity.trim();
    const value =
      trimmedQuantity === '' && product.stockQty === null ? null : Number(trimmedQuantity);
    if (
      value !== null &&
      (trimmedQuantity === '' || !Number.isInteger(value) || value < 0 || value > 2147483647)
    ) {
      setError('Nhập số nguyên từ 0 đến 2.147.483.647.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(product, value, effectiveAvailable);
      onClose();
    } catch (cause) {
      setError(inventoryError(cause));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="quantity-title"
      aria-describedby="quantity-description"
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-[470px] max-h-[calc(100dvh_-_2rem)] overflow-y-auto rounded-[24px] border-0 bg-[#FFFCF7] p-0 text-[#65402B] shadow-[0_24px_80px_rgba(48,30,18,0.22)] backdrop:bg-[#33251C]/50 backdrop:backdrop-blur-[3px] open:animate-in open:fade-in open:zoom-in-95"
    >
      <form className="p-5 sm:p-6" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A18B78]">
              {t('Tồn kho sản phẩm')}
            </p>

            <h2 id="quantity-title" className="text-[22px] font-semibold leading-tight">
              {t('Chỉnh số lượng')}
            </h2>
          </div>

          <button
            type="button"
            aria-label={t('Đóng hộp thoại')}
            disabled={saving}
            onClick={handleClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E8CBAA] text-xl text-[#70472F] transition hover:bg-[#F4E8D8] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-[#F3E6D4] px-3.5 py-3">
          <p id="quantity-description" className="truncate text-xs font-bold text-[#70472F]">
            {name(product.name)}
          </p>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#947E6B]">
              {t('Hiện còn')}{' '}
              <span className="ml-1 font-semibold text-[#65402B]">
                {quantity.trim() === '' ? '—' : number(Number(quantity))}
              </span>
            </div>

            <label htmlFor="product-availability" className="sr-only">
              {t('Trạng thái bán sản phẩm')}
            </label>

            <select
              id="product-availability"
              value={effectiveAvailable ? 'available' : 'unavailable'}
              disabled={saving || disabled || soldOut || !validQuantity}
              onChange={(event) => {
                handleAvailabilityChange(event.target.value as AvailabilityValue);
              }}
              className="max-w-[170px] rounded-xl border border-[#E7CBAA] bg-[#FFFCF7] px-3 py-2 text-xs font-semibold text-[#65402B] outline-none transition focus:border-[#A66B43] focus:ring-2 focus:ring-[#A66B43]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="available">{t('Đang bật bán')}</option>
              <option value="unavailable">{t('Đang tắt bán')}</option>
            </select>
          </div>
        </div>

        {soldOut && (
          <div
            role="status"
            className="mb-4 flex gap-2.5 rounded-xl border border-[#F1CB86] bg-[#FFF2D8] p-3 text-[#87551B]"
          >
            <span className="mt-px text-base" aria-hidden="true">
              ⚠
            </span>

            <div>
              <p className="text-xs font-bold">{t('Sản phẩm đã hết hàng')}</p>

              <p className="mt-1 text-[11px] leading-relaxed text-[#947448]">
                {t('Số lượng bằng 0. Sản phẩm sẽ tự động tắt bán.')}
              </p>
            </div>
          </div>
        )}

        <div className="mb-2">
          <label
            htmlFor="stock-quantity"
            className="mb-2 block text-xs font-semibold text-[#76503A]"
          >
            {t('Số lượng còn bán')}
            <span className="text-[#B66B43]">*</span>
          </label>

          <input
            autoFocus
            id="stock-quantity"
            type="number"
            min="0"
            max="2147483647"
            step="1"
            disabled={saving || disabled}
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              if (event.target.value.trim() !== '' && Number(event.target.value) === 0) {
                setAvailable(false);
              }
              setError('');
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'quantity-error' : 'quantity-help'}
            placeholder={t('Nhập số lượng')}
            className="w-full rounded-xl border border-[#E7CBAA] bg-transparent px-4 py-3 text-sm font-medium text-[#76503A] outline-none transition placeholder:text-[#B9A696] disabled:cursor-not-allowed disabled:bg-[#F4EDE4] disabled:text-[#B9A696]"
          />

          <p id="quantity-help" className="mt-2 text-[10px] leading-relaxed text-[#A18B78]">
            {t(
              'Nhập số lượng tồn kho mới. Đây là số lượng tuyệt đối, không phải số lượng cộng thêm.',
            )}
            {product.stockQty === null && t(' Để trống để giữ chế độ không theo dõi tồn kho.')}
          </p>
        </div>

        {error && (
          <p
            id="quantity-error"
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {t(error)}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleClose}
            className="rounded-xl border border-[#E7CBAA] px-5 py-3 text-xs font-semibold text-[#76503A] transition hover:bg-[#F5EADD] disabled:opacity-50 sm:py-2.5"
          >
            {t('Đóng')}
          </button>

          <button
            type="submit"
            disabled={saving || disabled}
            className="rounded-xl bg-[#684027] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#52311F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A66B43] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
          >
            {saving ? t('Đang lưu…') : t('Lưu số lượng')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
