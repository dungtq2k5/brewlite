import { useTranslation } from 'react-i18next';

/**
 * *#1038 marked Ready · Undo · 5*, counting down. The request leaves the tablet when the 5 s end;
 * *Undo* puts the card back and nothing has reached the customer.
 */
export function UndoToast({
  orderNo,
  to,
  secondsLeft,
  onUndo,
}: Readonly<{
  orderNo: string;
  to: 'READY' | 'COMPLETED';
  secondsLeft: number;
  onUndo: () => void;
}>) {
  const { t } = useTranslation('staff');
  return (
    <div
      role="status"
      className="bg-neutral text-neutral-content rounded-box fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3 shadow-lg sm:bottom-6"
    >
      <span>{t(`undo.${to}`, { no: orderNo })}</span>
      <button
        type="button"
        onClick={onUndo}
        aria-label={t('undo.label', { count: secondsLeft })}
        className="min-h-11 font-bold underline"
      >
        {t('undo.action')} · <span className="tabular-nums">{secondsLeft}</span>
      </button>
    </div>
  );
}
