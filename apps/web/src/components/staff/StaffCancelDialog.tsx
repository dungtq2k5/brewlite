'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { CANCEL_NOTE_MAX_LENGTH } from '@brewlite/contracts';
import { cancelPaidOrder } from '@/actions/staff';
import { useErrorMessage } from '../useErrorMessage';

const COUNTER_FROM = 160;
const PICKS = ['ingredient', 'machine', 'closing', 'customer'] as const;

/**
 * Cancel a paid order and refund the customer (D04 decision 6): a dialog on the tablet, a bottom
 * sheet on a phone. The reason is required — *Cancel and refund* stays disabled until there is one —
 * and the customer reads it word for word. A native `<dialog>`: focus is trapped, `Esc` keeps the
 * order, and *Keep order* is first in reading order.
 */
export function StaffCancelDialog({
  order,
  onClose,
  onCancelled,
  onRefused,
}: Readonly<{
  order: { id: string; orderNo: string };
  onClose: () => void;
  onCancelled: () => void;
  /** Someone started it first: close, and re-read the board to show where it is. */
  onRefused: () => void;
}>) {
  const { t } = useTranslation('staff');
  const message = useErrorMessage();
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState('');
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  /** A quick pick goes in at the cursor, or replaces an empty field — and stays editable. */
  const pick = (key: (typeof PICKS)[number]) => {
    const text = t(`cancel.picks.${key}`);
    const input = field.current;
    const start = input?.selectionStart ?? reason.length;
    const end = input?.selectionEnd ?? reason.length;
    const next =
      reason.trim() === '' ? text : `${reason.slice(0, start)}${text}${reason.slice(end)}`;
    setReason(next.slice(0, CANCEL_NOTE_MAX_LENGTH));
    input?.focus();
  };

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await cancelPaidOrder(order.id, reason);
      if (result.ok) return onCancelled();
      if (result.code === 'INVALID_STATE') return setRefused(true);
      setError(message(result.code, result.details));
    });

  const trimmed = reason.trim();
  return (
    <dialog
      ref={dialog}
      aria-labelledby="staff-cancel-title"
      onClose={onClose}
      className="bg-base-100 rounded-box m-auto w-full max-w-lg p-0 backdrop:bg-black/40 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex flex-col gap-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 id="staff-cancel-title" className="text-xl font-semibold">
          {t('cancel.title', { no: order.orderNo })}
        </h2>
        {refused ? (
          <>
            <p role="alert" className="text-error font-medium">
              {t('cancel.refused')}
            </p>
            <button type="button" className="btn btn-primary h-14" autoFocus onClick={onRefused}>
              {t('cancel.close')}
            </button>
          </>
        ) : (
          <>
            <p>{t('cancel.body')}</p>
            <button
              type="button"
              className="btn btn-outline h-14"
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              {t('cancel.keep')}
            </button>
            <div className="flex flex-col gap-2">
              <label htmlFor="staff-cancel-reason" className="font-semibold">
                {t('cancel.reason')}{' '}
                <span className="text-base-content/70 text-sm font-normal">
                  {t('cancel.required')}
                </span>
              </label>
              <div
                role="group"
                aria-label={t('cancel.picks.label')}
                className="flex flex-wrap gap-2"
              >
                {PICKS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(key)}
                    className="btn btn-sm btn-outline min-h-11 rounded-full"
                  >
                    {t(`cancel.picks.${key}`)}
                  </button>
                ))}
              </div>
              <textarea
                id="staff-cancel-reason"
                ref={field}
                value={reason}
                maxLength={CANCEL_NOTE_MAX_LENGTH}
                rows={3}
                placeholder={t('cancel.placeholder')}
                onChange={(e) => setReason(e.target.value)}
                className="textarea w-full"
              />
              {reason.length >= COUNTER_FROM && (
                <p className="text-base-content/70 text-right text-sm tabular-nums">
                  {t('cancel.counter', { count: reason.length, max: CANCEL_NOTE_MAX_LENGTH })}
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-error text-sm font-medium">
                {error}
              </p>
            )}
            <button
              type="button"
              className="btn btn-error h-14"
              disabled={trimmed === '' || pending}
              onClick={confirm}
            >
              {pending ? t('cancel.sending') : t('cancel.confirm')}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
