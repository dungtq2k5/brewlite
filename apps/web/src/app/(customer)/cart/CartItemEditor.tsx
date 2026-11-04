'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_QTY_PER_LINE, MAX_TOPPINGS_PER_LINE, type ProductSize } from '@brewlite/contracts';
import type {
  ProductDetailResponseDto,
  ProductDetailResponseDtoSizesItemSize,
} from '@brewlite/api-client';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button } from '@/components/vellum/Button';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { useCart, type CartItem } from '@/context/CartContext';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function CartItemEditor({
  item,
  locale,
  onClose,
}: {
  item: CartItem;
  locale: Locale;
  onClose: () => void;
}) {
  const isVi = locale === 'vi';
  const { updateItem } = useCart();
  const { showToast } = useToast();
  const initial = useRef({
    size: item.size as ProductDetailResponseDtoSizesItemSize,
    toppingIds: item.toppingIds,
    qty: item.qty,
  });
  const [product, setProduct] = useState<ProductDetailResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [size, setSize] = useState<ProductDetailResponseDtoSizesItemSize>(item.size);
  const [selectedToppings, setSelectedToppings] = useState<string[]>(item.toppingIds);
  const [qty, setQty] = useState(item.qty);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/v1/products/${encodeURIComponent(item.productId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('product request failed');
        const body: unknown = await response.json();
        if (!isRecord(body) || !isRecord(body.data)) throw new Error('unexpected response');
        const detail = body.data as unknown as ProductDetailResponseDto;
        const offeredSizes = detail.sizes ?? [];
        const maxToppings = Math.min(
          detail.maxToppings > 0 ? detail.maxToppings : MAX_TOPPINGS_PER_LINE,
          MAX_TOPPINGS_PER_LINE,
        );
        const availableToppings = new Set((detail.toppings ?? []).map((topping) => topping.id));
        const nextSize = offeredSizes.some((option) => option.size === initial.current.size)
          ? initial.current.size
          : (offeredSizes.find((option) => option.size === 'M')?.size ??
            offeredSizes[0]?.size ??
            initial.current.size);
        setProduct(detail);
        setSize(nextSize);
        setSelectedToppings(
          initial.current.toppingIds
            .filter((id) => availableToppings.has(id))
            .slice(0, maxToppings),
        );
        setQty(initial.current.qty);
      } catch (loadError) {
        if ((loadError as Error).name === 'AbortError') return;
        setError(
          isVi
            ? 'Không tải được lựa chọn của món này. Kiểm tra kết nối rồi thử lại.'
            : 'Could not load this item’s options. Check your connection and try again.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [item.productId, isVi]);

  const offeredSizes = product?.sizes ?? [];
  const toppings = product?.toppings ?? [];
  const maxToppings = Math.min(
    product && product.maxToppings > 0 ? product.maxToppings : MAX_TOPPINGS_PER_LINE,
    MAX_TOPPINGS_PER_LINE,
  );
  const basePriceVnd = product ? Number(product.basePriceVnd ?? product.fromPriceVnd ?? 0) : 0;
  const sizeDeltaVnd = offeredSizes.find((option) => option.size === size)?.priceDeltaVnd ?? 0;
  const selectedToppingObjects = toppings.filter((topping) =>
    selectedToppings.includes(topping.id),
  );
  const toppingsPriceVnd = selectedToppingObjects.reduce(
    (total, topping) => total + topping.priceVnd,
    0,
  );
  const unitPriceVnd = basePriceVnd + sizeDeltaVnd + toppingsPriceVnd;

  const toggleTopping = (toppingId: string) => {
    setSelectedToppings((previous) => {
      if (previous.includes(toppingId)) return previous.filter((id) => id !== toppingId);
      if (previous.length >= maxToppings) return previous;
      return [...previous, toppingId];
    });
  };

  const save = () => {
    if (!product || product.isSoldOut) return;
    const result = updateItem(item.id, {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      size: size as ProductSize,
      toppingIds: selectedToppings,
      toppingNames: selectedToppingObjects.map((topping) => topping.name),
      qty,
      basePriceVnd,
      sizeDeltaVnd,
      toppingsPriceVnd,
    });
    onClose();
    showToast(
      result === 'merged'
        ? isVi
          ? 'Món đã gộp vào một dòng có sẵn trong giỏ.'
          : 'Merged into an existing cart line.'
        : isVi
          ? 'Đã cập nhật món trong giỏ.'
          : 'Cart item updated.',
      { tone: 'success' },
    );
  };

  return (
    <Modal
      title={isVi ? 'Chỉnh sửa món' : 'Edit item'}
      meta={localized(item.name, locale)}
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            {isVi ? 'Hủy' : 'Cancel'}
          </Button>
          <Button disabled={loading || !!error || !product || product.isSoldOut} onClick={save}>
            {isVi ? 'Lưu thay đổi' : 'Save changes'}
          </Button>
        </>
      }
    >
      {loading && (
        <p className="notice" role="status">
          {isVi ? 'Đang tải lựa chọn…' : 'Loading options…'}
        </p>
      )}

      {!loading && error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      {!loading && product && (
        <>
          {product.isSoldOut && (
            <Notice tone="warning" role="status">
              {isVi
                ? 'Món này đang tạm hết. Bạn vẫn có thể xóa khỏi giỏ nhưng chưa thể lưu thay đổi.'
                : 'This item is temporarily out. You can remove it, but changes cannot be saved yet.'}
            </Notice>
          )}

          {offeredSizes.length > 0 && (
            <fieldset className="choice-field">
              <legend>
                {isVi ? 'Chọn size' : 'Choose size'}{' '}
                <span className="muted">({isVi ? 'bắt buộc' : 'required'})</span>
              </legend>
              <div
                className="size-band"
                style={{
                  gridTemplateColumns: `repeat(${offeredSizes.length}, minmax(0, 1fr))`,
                }}
              >
                {offeredSizes.map((option) => (
                  <label className="size-option" key={option.size}>
                    <input
                      type="radio"
                      name="cart-size"
                      value={option.size}
                      checked={size === option.size}
                      onChange={() => setSize(option.size)}
                    />
                    <span className="size-name">Size {option.size}</span>
                    <span className="size-delta">
                      {option.priceDeltaVnd > 0
                        ? `+${formatVnd(option.priceDeltaVnd, locale)}`
                        : isVi
                          ? 'Giá gốc'
                          : 'Base price'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {toppings.length > 0 && (
            <fieldset className="choice-field">
              <legend>
                {isVi ? 'Thêm topping' : 'Add toppings'}{' '}
                <span className="muted">
                  ({isVi ? `tối đa ${maxToppings}` : `max ${maxToppings}`})
                </span>
              </legend>
              <div className="topping-grid">
                {toppings.map((topping) => {
                  const checked = selectedToppings.includes(topping.id);
                  const disabled = !checked && selectedToppings.length >= maxToppings;
                  return (
                    <label className="topping-option" key={topping.id}>
                      <span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleTopping(topping.id)}
                        />{' '}
                        {localized(topping.name, locale)}
                      </span>
                      <span className="topping-price">+{formatVnd(topping.priceVnd, locale)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="qty-row">
            <div className="stepper" role="group" aria-label={isVi ? 'Số lượng' : 'Quantity'}>
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                disabled={qty <= 1}
                aria-label={isVi ? 'Giảm số lượng' : 'Decrease quantity'}
              >
                −
              </button>
              <output>{qty}</output>
              <button
                type="button"
                onClick={() => setQty((value) => Math.min(MAX_QTY_PER_LINE, value + 1))}
                disabled={qty >= MAX_QTY_PER_LINE}
                aria-label={isVi ? 'Tăng số lượng' : 'Increase quantity'}
              >
                +
              </button>
            </div>
          </div>

          <p className="product-price">
            <span className="money">{formatVnd(unitPriceVnd * qty, locale)}</span>
            <span className="muted">{isVi ? 'Tổng cho dòng này' : 'Line total'}</span>
          </p>
        </>
      )}
    </Modal>
  );
}
