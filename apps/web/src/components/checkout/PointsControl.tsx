'use client';

import { Minus, Plus, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuoteResponseDto } from '@brewlite/api-client';
import { LOYALTY_POINT_VALUE_VND, MIN_PAYABLE_VND } from '@brewlite/contracts';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { capLineFor, type PointsChoice } from '@/lib/checkout/points';

/**
 * Points at checkout (`113:1001`): a switch that uses all you can, *Use fewer* for a stepper.
 * Reads only the quote — hidden at a zero balance; the cap and why come from the server.
 */
export function PointsControl({
  quote,
  choice,
  onChange,
  warning,
}: Readonly<{
  quote: Pick<
    QuoteResponseDto,
    'pointsBalance' | 'pointsRedeemable' | 'pointsRedeemed' | 'pointsCapReason'
  >;
  choice: PointsChoice;
  onChange: (next: PointsChoice) => void;
  /** *Your balance changed — you now have N points.* after `POINTS_INSUFFICIENT`. */
  warning?: string | null;
}>) {
  const { t, i18n } = useTranslation('checkout');
  const locale = i18n.language as Locale;
  const id = useId();
  const [typing, setTyping] = useState<string | null>(null);
  if (quote.pointsBalance <= 0 && !warning) return null;

  const on = choice.mode !== 'off';
  const shown = on ? quote.pointsRedeemed : quote.pointsRedeemable;
  const amount = formatVnd(shown * LOYALTY_POINT_VALUE_VND, locale);
  const cap = capLineFor(quote, choice);
  const max = Math.max(1, quote.pointsRedeemable);
  const current = choice.mode === 'some' ? Math.min(choice.n, max) : quote.pointsRedeemed;
  const setN = (n: number) => onChange({ mode: 'some', n: Math.min(Math.max(1, n), max) });
  const stepper = 'btn btn-circle btn-ghost bg-base-100 size-11';

  return (
    <section
      aria-labelledby={`${id}-label`}
      className={`rounded-box border p-4 ${on ? 'border-primary/40 bg-secondary' : 'border-base-300 bg-base-100'}`}
    >
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden size={18} className="text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p id={`${id}-label`} className="font-semibold">
            {on
              ? t('points.using', { count: shown, amount })
              : t('points.use', { count: shown, amount })}
          </p>
          <p className="text-base-content/70 text-sm">
            {t('points.have', { count: quote.pointsBalance })}
          </p>
        </div>
        <input
          type="checkbox"
          role="switch"
          className="toggle toggle-primary"
          aria-label={t('points.switch', { count: quote.pointsBalance })}
          checked={on}
          disabled={quote.pointsRedeemable === 0}
          onChange={(e) => onChange(e.target.checked ? { mode: 'all' } : { mode: 'off' })}
        />
      </div>

      {on && choice.mode === 'all' && quote.pointsRedeemable > 1 && (
        <button
          type="button"
          className="mt-2 min-h-11 text-sm font-semibold underline"
          onClick={() => setN(quote.pointsRedeemed)}
        >
          {t('points.fewer')}
        </button>
      )}

      {on && choice.mode === 'some' && (
        <div className="mt-3 flex items-center gap-3">
          <div className="bg-base-100 flex items-center rounded-full">
            <button
              type="button"
              className={stepper}
              aria-label={t('points.less')}
              disabled={current <= 1}
              onClick={() => setN(current - 1)}
            >
              <Minus aria-hidden size={18} />
            </button>
            <input
              inputMode="numeric"
              aria-label={t('points.number')}
              className="w-12 bg-transparent text-center font-bold tabular-nums"
              value={typing ?? String(current)}
              onFocus={() => setTyping(String(current))}
              onChange={(e) => setTyping(e.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                if (typing && Number(typing) >= 1) onChange({ mode: 'some', n: Number(typing) }); // the server clips
                setTyping(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
            <button
              type="button"
              className={stepper}
              aria-label={t('points.more')}
              disabled={current >= max}
              onClick={() => setN(current + 1)}
            >
              <Plus aria-hidden size={18} />
            </button>
          </div>
          <p className="text-base-content/70 text-sm">
            {t('points.upTo', { max: quote.pointsRedeemable })}
          </p>
        </div>
      )}

      {cap && (
        <p className="text-base-content/80 mt-2 text-sm">
          {t(`points.cap.${cap}`, { min: formatVnd(MIN_PAYABLE_VND, locale) })}
        </p>
      )}
      {warning && (
        <p
          role="alert"
          className="text-warning-content bg-warning/20 rounded-box mt-2 px-3 py-2 text-sm"
        >
          {warning}
        </p>
      )}
    </section>
  );
}
