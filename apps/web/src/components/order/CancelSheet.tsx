'use client';

import { useTranslation } from 'react-i18next';

/** *Cancel this order?* — a bottom sheet on phones, a dialog on wide screens. Focus starts on *Keep*. */
export function CancelSheet({
  orderNo,
  pending,
  onConfirm,
  onClose,
}: Readonly<{ orderNo: string; pending: boolean; onConfirm: () => void; onClose: () => void }>) {
  const { t } = useTranslation('orders');
  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center sm:items-center"
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="bg-base-100 relative w-full rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-box sm:max-w-sm"
      >
        <h2 id="cancel-title" className="mb-2 text-xl font-semibold">
          {t('order.cancel.title')}
        </h2>
        <p className="mb-6">{t('order.cancel.body', { no: `#${orderNo}` })}</p>
        <button
          type="button"
          className="btn btn-error w-full"
          onClick={onConfirm}
          disabled={pending}
        >
          {t('order.cancel.confirm')}
        </button>
        <button type="button" className="btn btn-ghost mt-2 w-full" onClick={onClose} autoFocus>
          {t('order.cancel.keep')}
        </button>
      </div>
    </div>
  );
}
