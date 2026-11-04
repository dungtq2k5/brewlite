'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  MAX_TOPPINGS_PER_LINE,
  type ProductSize,
} from '@brewlite/contracts';
import type {
  ProductDetailResponseDto,
  ProductDetailResponseDtoSizesItemSize,
} from '@brewlite/api-client';
import { useToast } from '@/components/feedback/ToastProvider';
import { Notice } from '@/components/vellum/Notice';
import ProductArtwork from '@/components/ProductArtwork';
import { useCart } from '@/context/CartContext';
import { formatVnd, localized } from '@/i18n/format';

interface Props {
  product: ProductDetailResponseDto;
  locale: 'vi' | 'en';
  categoryName?: string | null;
}

export default function ProductDetailClient({ product, locale, categoryName }: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const isVi = locale === 'vi';
  const offeredSizes = product.sizes ?? [];
  const defaultSize: ProductDetailResponseDtoSizesItemSize = offeredSizes.some(
    (option) => option.size === 'M',
  )
    ? 'M'
    : (offeredSizes[0]?.size ?? 'M');

  const [size, setSize] = useState<ProductDetailResponseDtoSizesItemSize>(defaultSize);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [cartError, setCartError] = useState('');
  const [checkingStock, setCheckingStock] = useState(false);

  const name = localized(product.name, locale);
  const altName = localized(product.name, isVi ? 'en' : 'vi');
  const description = product.description ? localized(product.description, locale) : '';
  const basePriceVnd = Number(product.basePriceVnd ?? product.fromPriceVnd ?? 0);
  const sizeOption = offeredSizes.find((option) => option.size === size);
  const sizeDeltaVnd = Number(sizeOption?.priceDeltaVnd ?? 0);
  const toppings = product.toppings ?? [];
  const maxToppings = Math.min(
    product.maxToppings > 0 ? product.maxToppings : MAX_TOPPINGS_PER_LINE,
    MAX_TOPPINGS_PER_LINE,
  );
  const selectedToppingObjects = toppings.filter((topping) =>
    selectedToppings.includes(topping.id),
  );
  const toppingsPriceVnd = selectedToppingObjects.reduce(
    (total, topping) => total + topping.priceVnd,
    0,
  );
  const unitPriceVnd = basePriceVnd + sizeDeltaVnd + toppingsPriceVnd;
  const image = product.imageUrl;

  const toggleTopping = (toppingId: string) => {
    setSelectedToppings((previous) => {
      if (previous.includes(toppingId)) return previous.filter((id) => id !== toppingId);
      if (previous.length >= maxToppings) return previous;
      return [...previous, toppingId];
    });
  };

  const addToCart = async () => {
    if (product.isSoldOut || checkingStock) return;
    setCartError('');
    setCheckingStock(true);

    // The page may have been open before staff switched the item off. Re-read it
    // once at the moment of adding so a stale button can never create a cart line.
    try {
      const response = await fetch(`/api/v1/products/${encodeURIComponent(product.id)}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('product request failed');
      const body: unknown = await response.json();
      const fresh =
        body && typeof body === 'object'
          ? (body as { data?: ProductDetailResponseDto }).data
          : undefined;
      if (!fresh || fresh.isSoldOut) {
        setCartError(
          isVi
            ? 'Món này vừa tạm hết nên chưa thể thêm vào giỏ. Thực đơn sẽ tự cập nhật.'
            : 'This item just went out, so it cannot be added. The menu will refresh.',
        );
        router.refresh();
        return;
      }
    } catch {
      setCartError(
        isVi
          ? 'Không kiểm tra được tình trạng món. Kiểm tra kết nối rồi thử lại.'
          : 'Could not check whether this item is available. Check your connection and try again.',
      );
      return;
    } finally {
      setCheckingStock(false);
    }

    const added = addItem({
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
    if (!added) {
      setCartError(
        isVi
          ? `Giỏ hàng đã đạt tối đa ${MAX_LINES_PER_ORDER} dòng. Xóa bớt một món rồi thêm lại.`
          : `Your cart already has the maximum ${MAX_LINES_PER_ORDER} lines. Remove one and try again.`,
      );
      return;
    }
    showToast(isVi ? `Đã thêm ${qty} × ${name} vào giỏ.` : `Added ${qty} × ${name} to the cart.`, {
      action: {
        label: isVi ? 'Xem giỏ' : 'View cart',
        onClick: () => router.push('/cart'),
      },
    });
    // Most buyers pick several drinks in a row; return them to the menu while the
    // toast keeps the cart one tap away.
    router.push('/');
  };

  const currentChoice = isVi
    ? `Size ${size}${selectedToppings.length > 0 ? `, ${selectedToppings.length} topping` : ''}`
    : `Size ${size}${selectedToppings.length > 0 ? `, ${selectedToppings.length} topping${selectedToppings.length > 1 ? 's' : ''}` : ''}`;

  return (
    <div className="product-layout">
      <div className="product-panel">
        <h1 className="page-title">{name}</h1>
        {altName && altName !== name && <p className="page-meta">{altName}</p>}
        {product.isSoldOut && (
          <p style={{ marginTop: 'var(--space-sm)' }}>
            <span className="tag tag--error">{isVi ? 'Tạm hết' : 'Temporarily out'}</span>
          </p>
        )}
        {description && (
          <p className="statement" style={{ marginTop: 'var(--space-sm)' }}>
            {description}
          </p>
        )}

        <div className="product-price">
          <span className="money">{formatVnd(unitPriceVnd, locale)}</span>
          <span className="muted">
            {currentChoice}
            {isVi ? ', đã tính topping' : ', selected toppings included'}
          </span>
        </div>

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
                    name="size"
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

          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              void addToCart();
            }}
            disabled={product.isSoldOut || checkingStock}
            style={{ justifyContent: 'space-between' }}
          >
            <span>
              {product.isSoldOut
                ? isVi
                  ? 'Tạm hết'
                  : 'Temporarily out'
                : checkingStock
                  ? isVi
                    ? 'Đang kiểm tra…'
                    : 'Checking…'
                  : isVi
                    ? 'Thêm vào giỏ'
                    : 'Add to cart'}
            </span>
            <span className="money">{formatVnd(unitPriceVnd * qty, locale)}</span>
          </button>
        </div>

        {cartError && (
          <Notice tone="error" role="alert">
            {cartError}
          </Notice>
        )}
      </div>

      {image ? (
        <div className="product-media">
          <figure className="photo photo--portrait">
            <Image
              src={image}
              alt={name}
              width={800}
              height={1000}
              sizes="(max-width: 60rem) 100vw, 50vw"
              priority
              unoptimized={
                image.startsWith('http://localhost:29199') ||
                image.startsWith('http://127.0.0.1:29199')
              }
            />
          </figure>
        </div>
      ) : (
        <div className="product-media">
          <ProductArtwork categoryName={categoryName} locale={locale} />
        </div>
      )}
    </div>
  );
}
