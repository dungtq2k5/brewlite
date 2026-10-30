'use client';

import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { lineTotalVnd, unitPriceVnd, type CartLine as Line } from '@/lib/cart/cart';
import { unavailableText, type UnavailableReason } from '@/lib/cart/unavailable';
import { ProductImage } from '../menu/ProductImage';
import { QuantityStepper } from '../product/QuantityStepper';

export function CartLine({
  line,
  onQuantity,
  onRemove,
  unavailable,
}: Readonly<{
  line: Line;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  unavailable?: UnavailableReason;
}>) {
  const { t, i18n } = useTranslation(['cart', 'menu']);
  const locale = i18n.language as Locale;
  const name = localized(line.name, locale);
  const toppings = line.toppings.map((tp) => localized(tp.name, locale)).join(', ');
  const details = [t(`menu:product.size.name.${line.size}`), toppings].filter(Boolean).join(' · ');

  return (
    <li className="border-base-300 flex gap-3 border-b py-4 last:border-b-0">
      <div className="rounded-box size-16 shrink-0 overflow-hidden">
        <ProductImage imageUrl={line.imageUrl} name={name} variant={line.noPhoto} iconSize={28} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{name}</p>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('cart:line.removeLabel', { name })}
            className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Trash2 aria-hidden size={20} />
          </button>
        </div>
        <p className="text-base-content/80 text-sm">{details}</p>
        {unavailable ? (
          <div className="mt-2">
            <p className="text-error text-sm font-medium">
              {unavailableText(t, unavailable, line, locale)}
            </p>
            <p className="text-sm">{t('cart:unavailable.notCounted')}</p>
          </div>
        ) : (
          <>
            <p className="text-xs">
              {t('cart:line.each', { price: formatVnd(unitPriceVnd(line), locale) })}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <QuantityStepper value={line.quantity} onChange={onQuantity} name={name} />
              <span className="font-bold tabular-nums">
                {formatVnd(lineTotalVnd(line), locale)}
              </span>
            </div>
          </>
        )}
      </div>
    </li>
  );
}
