import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OrderResponseDto } from '@brewlite/api-client';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { nextMove, type BoardStatus, type MoveTo } from '@/lib/staff/board';
import { isLongWait } from '@/lib/staff/wait';
import { OrderTicket } from '../order/OrderTicket';
import { WaitChip } from './WaitChip';

/**
 * One order on the board, top to bottom (D04 decision 1): the ticket, the wait chip (*New* while
 * new) with *Cancel…* at the far end on *Paid* cards, the lines, the note as a warning block, and
 * one 56 px forward button. No customer name anywhere — the number is the handover.
 */
export function BoardOrderCard({
  order,
  column,
  inFlightTo,
  isNew,
  minutes,
  movedElsewhere,
  error,
  canCancel,
  onForward,
  onCancel,
}: Readonly<{
  order: OrderResponseDto;
  column: BoardStatus;
  inFlightTo?: MoveTo;
  isNew: boolean;
  minutes: number;
  movedElsewhere: boolean;
  error?: string;
  canCancel: boolean;
  onForward: (to: MoveTo) => void;
  onCancel: () => void;
}>) {
  const { t, i18n } = useTranslation(['staff', 'menu']);
  const locale = i18n.language as Locale;
  const other: Locale = locale === 'vi' ? 'en' : 'vi';
  const to = nextMove(column);
  const long = isLongWait(minutes);
  const border = isNew
    ? 'border-accent border-2'
    : long
      ? 'border-warning border-2'
      : column === 'READY'
        ? 'border-success/50 border-2'
        : 'border-base-300';

  return (
    <li className={`bg-base-100 rounded-box flex flex-col gap-3 border p-3 ${border}`}>
      <OrderTicket orderNo={order.orderNo} size="medium" align="start" />
      <div className="flex min-h-11 items-center gap-2">
        {isNew && (
          <span className="bg-accent text-accent-content rounded-full px-2 py-1 text-xs font-bold">
            {t('new.chip')}
          </span>
        )}
        <WaitChip minutes={minutes} />
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('aria.cancel', { no: order.orderNo })}
            className="text-error ml-auto min-h-11 px-2 text-sm font-semibold underline"
          >
            {t('cancel.button')}
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {order.lines.map((line) => {
          const toppings = line.toppings.map((tp) => localized(tp.name, locale)).join(', ');
          const details = [t(`menu:product.size.name.${line.size}`), toppings]
            .filter(Boolean)
            .join(' · ');
          return (
            <li
              key={`${line.productId}|${line.size}|${line.toppings.map((tp) => tp.toppingId).join(',')}`}
              className="flex gap-3"
            >
              <span className="text-primary w-9 shrink-0 text-xl leading-tight font-extrabold tabular-nums">
                {line.qty}×
              </span>
              <div className="min-w-0">
                <p className="text-[17px] leading-tight font-semibold">
                  {localized(line.productName, locale)}
                </p>
                {localized(line.productName, other) !== localized(line.productName, locale) && (
                  <p className="text-base-content/60 text-xs">
                    {localized(line.productName, other)}
                  </p>
                )}
                {details && <p className="text-sm">{details}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {order.note && (
        <p className="bg-warning text-warning-content rounded-field flex gap-2 px-3 py-2 font-bold">
          <TriangleAlert aria-hidden size={20} className="mt-0.5 shrink-0" />
          <span>
            <span className="sr-only">{t('line.note')}: </span>
            {order.note}
          </span>
        </p>
      )}

      {movedElsewhere && (
        <p
          role="status"
          className="bg-info/10 text-info rounded-field px-3 py-2 text-sm font-medium"
        >
          {t('moved')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-error text-sm font-medium">
          {error}
        </p>
      )}

      {to && (
        <button
          type="button"
          disabled={inFlightTo !== undefined}
          onClick={() => onForward(to)}
          aria-label={inFlightTo ? undefined : t(`aria.${column}`, { no: order.orderNo })}
          className="btn btn-primary h-14 w-full text-lg"
        >
          {inFlightTo ? (
            <>
              <LoaderCircle
                aria-hidden
                size={20}
                className="animate-spin motion-reduce:animate-none"
              />
              {t(`inFlight.${inFlightTo}`)}
            </>
          ) : (
            t(`action.${column}`)
          )}
        </button>
      )}
    </li>
  );
}
