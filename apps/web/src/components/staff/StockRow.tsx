'use client';

import { LoaderCircle, Minus, Plus } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StaffProductResponseDto } from '@brewlite/api-client';
import { setProductAvailability, setProductStock } from '@/actions/staff';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import {
  customerSees,
  initialStock,
  nextSave,
  shownStock,
  stockReducer,
  type StockAction,
} from '@/lib/staff/stock';

const DEBOUNCE_MS = 600;

/**
 * One product's stock (D04 decision 8): why it is on or off sale (text, not colour), the
 * *Available* switch, and counting — *Not counted* → *Count stock*; counted → a stepper saved
 * 600 ms after the last tap, *Edit* for direct entry, *Stop counting*. Each save carries **the
 * version the previous one returned**, one save flies at a time, and a conflict resets the row to
 * the server's count (nothing retries by itself). Saving and failures show on this row only.
 */
export function StockRow({ product }: Readonly<{ product: StaffProductResponseDto }>) {
  const { t, i18n } = useTranslation('staff');
  const locale = i18n.language as Locale;
  const other: Locale = locale === 'vi' ? 'en' : 'vi';
  const name = localized(product.name, locale);

  const [available, setAvailable] = useState(product.isAvailable);
  const [toggleFailed, setToggleFailed] = useState<'on' | 'off' | null>(null);
  const [state, dispatch] = useReducer(
    stockReducer,
    initialStock({ stockQty: product.stockQty, version: product.version }),
  );
  const [editing, setEditing] = useState(false);
  // Focus goes into the count field only because the staff member just tapped *Edit* / *Count*.
  const draftField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) draftField.current?.focus();
  }, [editing]);
  const [draft, setDraft] = useState('');

  // The logic reads this mirror (kept in step by `apply`); React state only paints it.
  const latest = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draining = useRef(false);

  const apply = (action: StockAction) => {
    latest.current = stockReducer(latest.current, action);
    dispatch(action);
  };

  async function drain() {
    if (draining.current) return;
    draining.current = true;
    try {
      for (;;) {
        const save = nextSave(latest.current);
        if (!save) return;
        apply({ type: 'sent' });
        const result = await setProductStock(product.id, save.stockQty, save.expectedVersion);
        if (result.ok) {
          apply({ type: 'saved', stockQty: result.data.stockQty, version: result.data.version });
          continue;
        }
        const details = result.details as
          { currentStockQty?: number | null; currentVersion?: number } | undefined;
        if (result.code === 'STOCK_VERSION_CONFLICT' && details?.currentVersion !== undefined) {
          const current = details.currentStockQty ?? null;
          apply({
            type: 'conflict',
            currentStockQty: current,
            currentVersion: details.currentVersion,
          });
          setDraft(current === null ? '' : String(current));
        } else {
          apply({ type: 'failed' });
        }
        return;
      }
    } finally {
      draining.current = false;
    }
  }

  const want = (value: number | null, { now }: { now: boolean }) => {
    apply({ type: 'want', value });
    if (timer.current) clearTimeout(timer.current);
    if (now) void drain();
    else timer.current = setTimeout(() => void drain(), DEBOUNCE_MS);
  };

  const shown = shownStock(state);
  const counted = shown !== null;
  const sees = customerSees(available, state.saved.stockQty);

  const toggle = async () => {
    const next = !available;
    setAvailable(next);
    setToggleFailed(null);
    const result = await setProductAvailability(product.id, next);
    if (!result.ok) {
      setAvailable(!next);
      setToggleFailed(next ? 'on' : 'off');
    }
  };

  const saveDraft = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(n) || n < 0) return;
    setEditing(false);
    want(n, { now: true });
  };

  return (
    <li className="bg-base-100 rounded-box flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg leading-tight font-semibold">{name}</p>
          <p className="text-base-content/60 text-xs">{localized(product.name, other)}</p>
          <p className="mt-1 text-sm">
            <span className="text-base-content/70">{t('stock.sees.label')}: </span>
            <span className={`font-semibold ${sees === 'onSale' ? 'text-success' : 'text-error'}`}>
              {t(`stock.sees.${sees}`)}
            </span>
          </p>
        </div>
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

      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label={t('stock.count.value', { name })}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
              className="input w-28"
              ref={draftField}
            />
            <button type="button" className="btn btn-primary min-h-11" onClick={saveDraft}>
              {t('stock.count.save')}
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-11"
              onClick={() => setEditing(false)}
            >
              {t('stock.count.cancel')}
            </button>
          </>
        ) : counted ? (
          <>
            <div className="bg-base-200 flex items-center rounded-full">
              <button
                type="button"
                aria-label={t('stock.count.dec', { name })}
                disabled={shown === 0}
                onClick={() => want(Math.max(0, shown - 1), { now: false })}
                className="grid size-11 place-items-center rounded-full disabled:opacity-40"
              >
                <Minus aria-hidden size={18} />
              </button>
              <span role="status" className="min-w-10 text-center text-lg font-bold tabular-nums">
                {shown}
              </span>
              <button
                type="button"
                aria-label={t('stock.count.inc', { name })}
                onClick={() => want(shown + 1, { now: false })}
                className="grid size-11 place-items-center rounded-full"
              >
                <Plus aria-hidden size={18} />
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost min-h-11"
              onClick={() => {
                setDraft(String(shown));
                setEditing(true);
              }}
            >
              {t('stock.count.edit')}
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-11"
              onClick={() => want(null, { now: true })}
            >
              {t('stock.count.stop')}
            </button>
          </>
        ) : (
          <>
            <span className="text-base-content/70">{t('stock.count.none')}</span>
            <button
              type="button"
              className="btn btn-outline min-h-11"
              onClick={() => {
                setDraft('');
                setEditing(true);
              }}
            >
              {t('stock.count.start')}
            </button>
          </>
        )}
        {state.inFlight && (
          <span className="text-base-content/70 flex items-center gap-1 text-sm">
            <LoaderCircle
              aria-hidden
              size={14}
              className="animate-spin motion-reduce:animate-none"
            />
            {t('stock.count.saving')}
          </span>
        )}
      </div>

      {state.conflict && (
        <p role="alert" className="bg-warning/20 rounded-field px-3 py-2 text-sm font-medium">
          {state.conflict.currentStockQty === null
            ? t('stock.conflictNone')
            : t('stock.conflict', { count: state.conflict.currentStockQty })}
        </p>
      )}
      {state.failed && (
        <p role="alert" className="text-error text-sm font-medium">
          {t('stock.saveFailed')}
        </p>
      )}
      {toggleFailed && (
        <p role="alert" className="text-error text-sm font-medium">
          {t(`stock.toggleFailed.${toggleFailed}`)}
        </p>
      )}
    </li>
  );
}
