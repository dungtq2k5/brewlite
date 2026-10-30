'use client';

import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { lineTotalVnd, unitPriceVnd, type CartLine as Line } from '@/lib/cart/cart';
import { unavailableText, type UnavailableReason } from '@/lib/cart/unavailable';
import { ProductImage } from '../menu/ProductImage';
import { QuantityStepper } from '../product/QuantityStepper';

/**
 * Where a line's prices come from: the cart's own preview (`/cart`), the server's quote
 * (`checkout` — never the preview, architecture §4.3), or nowhere while a refusal stands.
 */
export type LinePricing = 'cart' | 'hidden' | { unitPriceVnd: number; lineTotalVnd: number };

export function CartLine({
  line,
  onQuantity,
  onRemove,
  unavailable,
  pricing = 'cart',
  stockLeft,
}: Readonly<{
  line: Line;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  unavailable?: UnavailableReason;
  pricing?: LinePricing;
  /** `OUT_OF_STOCK`: the line keeps its stepper and gets an error line under it. */
  stockLeft?: number;
}>) {
  const { t, i18n } = useTranslation(['cart', 'menu', 'checkout']);
  const locale = i18n.language as Locale;
  const name = localized(line.name, locale);
  const toppings = line.toppings.map((tp) => localized(tp.name, locale)).join(', ');
  const details = [t(`menu:product.size.name.${line.size}`), toppings].filter(Boolean).join(' · ');
  const prices =
    pricing === 'cart'
      ? { unit: unitPriceVnd(line), total: lineTotalVnd(line) }
      : pricing === 'hidden'
        ? null
        : { unit: pricing.unitPriceVnd, total: pricing.lineTotalVnd };

  return (
    <li className="border-base-300 flex gap-3 border-b py-4 last:border-b-0">
      <div
        className={`rounded-box size-16 shrink-0 overflow-hidden ${unavailable ? 'opacity-50' : ''}`}
      >
        <ProductImage imageUrl={line.imageUrl} name={name} variant={line.noPhoto} iconSize={28} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`font-semibold ${unavailable ? 'text-base-content/60' : ''}`}>{name}</p>
          {!unavailable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={t('cart:line.removeLabel', { name })}
              className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full"
            >
              <Trash2 aria-hidden size={20} />
            </button>
          )}
        </div>
        <p className={`text-sm ${unavailable ? 'text-base-content/60' : 'text-base-content/80'}`}>
          {details}
        </p>
        {unavailable ? (
          <div className="mt-2">
            <div className="bg-error/10 text-error rounded-field flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
              <span>{unavailableText(t, unavailable, line, locale)}</span>
              <button
                type="button"
                onClick={onRemove}
                aria-label={t('cart:line.removeLabel', { name })}
                className="min-h-11 font-semibold whitespace-nowrap underline"
              >
                {t('cart:line.remove')}
              </button>
            </div>
            <p className="mt-1 text-xs">{t('cart:unavailable.notCounted')}</p>
          </div>
        ) : (
          <>
            {prices && (
              <p className="text-xs">
                {t('cart:line.each', { price: formatVnd(prices.unit, locale) })}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <QuantityStepper value={line.quantity} onChange={onQuantity} name={name} />
              {prices && (
                <span className="font-bold tabular-nums">{formatVnd(prices.total, locale)}</span>
              )}
            </div>
            {stockLeft !== undefined && (
              <p role="alert" className="text-error mt-1 text-sm font-medium">
                {stockLeft > 0
                  ? t('checkout:refusal.stockLeft', { available: stockLeft })
                  : t('checkout:refusal.stockNone')}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
