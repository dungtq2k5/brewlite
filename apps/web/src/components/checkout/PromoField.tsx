'use client';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { PROMO_CODE_MAX_LENGTH } from '@brewlite/contracts';

/**
 * The code is typed into component state and sent on *Apply* (the gateway trims and upper-cases
 * it). Applied, the field becomes the code with the amount it takes off and *Remove*.
 */
export function PromoField({
  value,
  onChange,
  onApply,
  onRemove,
  applying,
  appliedLabel,
  error,
}: Readonly<{
  value: string;
  onChange: (next: string) => void;
  onApply: () => void;
  onRemove: () => void;
  applying: boolean;
  /** `WELCOME10 · −₫21,000` when a code is applied and the quote took it. */
  appliedLabel: string | null;
  error: string | null;
}>) {
  const { t } = useTranslation('checkout');
  const id = useId();

  if (appliedLabel) {
    return (
      <div>
        <p className="mb-1 text-sm font-semibold">{t('promo.label')}</p>
        <div className="bg-success/10 text-success rounded-field flex min-h-11 items-center justify-between gap-3 px-3 font-semibold">
          <span>{appliedLabel}</span>
          <button type="button" onClick={onRemove} className="min-h-11 underline">
            {t('promo.remove')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {t('promo.label')}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={PROMO_CODE_MAX_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="WELCOME10"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`input flex-1 ${error ? 'input-error' : ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (value.trim() !== '') onApply();
            }
          }}
        />
        <button
          type="button"
          onClick={onApply}
          disabled={applying || value.trim() === ''}
          className="btn btn-secondary"
        >
          {applying ? t('promo.applying') : t('promo.apply')}
        </button>
      </div>
      <p id={`${id}-error`} aria-live="polite" className="text-error mt-1 min-h-0 text-sm">
        {error}
      </p>
    </div>
  );
}
