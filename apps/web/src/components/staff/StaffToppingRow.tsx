'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StaffToppingResponseDto } from '@brewlite/api-client';
import { setToppingAvailability } from '@/actions/staff';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

/** A topping: its name, price and one *Available* switch — optimistic, flipped back if it fails. */
export function StaffToppingRow({ topping }: Readonly<{ topping: StaffToppingResponseDto }>) {
  const { t, i18n } = useTranslation('staff');
  const locale = i18n.language as Locale;
  const other: Locale = locale === 'vi' ? 'en' : 'vi';
  const name = localized(topping.name, locale);
  const [available, setAvailable] = useState(topping.isAvailable);
  const [failed, setFailed] = useState<'on' | 'off' | null>(null);

  const toggle = async () => {
    const next = !available;
    setAvailable(next);
    setFailed(null);
    const result = await setToppingAvailability(topping.id, next);
    if (!result.ok) {
      setAvailable(!next);
      setFailed(next ? 'on' : 'off');
    }
  };

  return (
    <li className="bg-base-100 rounded-box flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-semibold">{name}</p>
          <p className="text-base-content/60 text-xs">{localized(topping.name, other)}</p>
        </div>
        <span className="tabular-nums">{formatVnd(topping.priceVnd, locale)}</span>
        <label className="flex min-h-11 items-center gap-2">
          <span className="text-sm font-medium max-sm:sr-only">{t('stock.available')}</span>
          <input
            type="checkbox"
            role="switch"
            className="toggle toggle-success"
            aria-label={t('stock.availableFor', { name })}
            checked={available}
            onChange={() => void toggle()}
          />
        </label>
      </div>
      {failed && (
        <p role="alert" className="text-error text-sm font-medium">
          {t(`stock.toggleFailed.${failed}`)}
        </p>
      )}
    </li>
  );
}
