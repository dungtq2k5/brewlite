'use client';
import { useStaffI18n } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_LABELS } from './order.constants';
import type { Order } from './order.types';
import { inventoryError } from '../inventory/inventory-api';
type CancelOrderDialogProps = {
  order: Order;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};
export function CancelOrderDialog({ order, onClose, onConfirm }: CancelOrderDialogProps) {
  const { t, money } = useStaffI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [reason, setReason] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.normalize('NFC').trim();
    if (!trimmedReason || trimmedReason.length > 200 || submitting.current) {
      return;
    }
    submitting.current = true;
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(trimmedReason);
      setCancelled(true);
    } catch (err) {
      setError(inventoryError(err));
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        if (!submitting.current) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onClose();
      }}
      onClick={(event) => {
        if (submitting.current || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
      aria-labelledby="cancel-order-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[388px] overflow-y-auto rounded-2xl border-0 bg-[#fffcf7] p-5 text-[11px] text-[#734932] shadow-2xl backdrop:bg-[#2d1d1473] sm:p-6"
    >
      {cancelled ? (
        <>
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[9px] uppercase tracking-[0.12em] text-[#9a8c7c]">
                {t('Đã cập nhật')}
              </p>

              <h2 id="cancel-order-title" className="mb-0 mt-1 text-base font-medium">
                {t('Đã hủy đơn #{number}', { number: order.orderNo })}
              </h2>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!submitting.current) onClose();
              }}
              aria-label={t('Đóng popup')}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#ecd4b2] text-xl hover:bg-[#f6e9d4]"
            >
              ×
            </button>
          </header>

          <div className="my-2.5 flex justify-center">
            <div className="grid size-11 place-items-center rounded-full bg-[#dce7dc] text-[#355b48]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            </div>
          </div>

          <section className="rounded-lg bg-[#f5ecdf] p-2.5">
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
              <dt className="text-[#9a8c7c]">{t('Trạng thái đơn')}</dt>
              <dd className="m-0 text-right font-semibold">{t('Đã hủy')}</dd>

              <dt className="text-[#9a8c7c]">{t('Trạng thái hoàn tiền')}</dt>
              <dd className="m-0 text-right font-semibold">
                {t(
                  (
                    {
                      NONE: t('Không hoàn tiền'),
                      PENDING: t('Đang xử lý'),
                      REFUNDED: t('Đã hoàn tiền'),
                      FAILED: t('Hoàn tiền thất bại'),
                    } as Record<string, string>
                  )[order.refundStatus] ?? t('Không xác định'),
                )}
              </dd>
            </dl>
          </section>

          <footer className="mt-2.5 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!submitting.current) onClose();
              }}
              className="h-8 cursor-pointer rounded-lg bg-[#694027] px-4 font-bold text-white transition-colors hover:bg-[#805236] active:bg-[#55321f]"
            >
              {t('Đóng')}
            </button>
          </footer>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[9px] uppercase tracking-[0.12em] text-[#9a8c7c]">
                {t('Xác nhận thao tác')}
              </p>

              <h2 id="cancel-order-title" className="mb-0 mt-1 text-xl font-medium">
                {t('Hủy đơn #{number}', { number: order.orderNo })}
              </h2>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!submitting.current) onClose();
              }}
              aria-label={t('Đóng popup')}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#ecd4b2] text-xl hover:bg-[#f6e9d4]"
            >
              ×
            </button>
          </header>

          <section className="mt-3 rounded-xl bg-[#f5ecdf] p-3">
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
              <dt className="text-[#9a8c7c]">{t('Mã đơn')}</dt>
              <dd className="m-0 text-right font-semibold">#{order.orderNo}</dd>

              <dt className="text-[#9a8c7c]">{t('Tổng đã thanh toán')}</dt>
              <dd className="m-0 text-right font-semibold">{money(order.totalVnd)}</dd>

              <dt className="text-[#9a8c7c]">{t('Trạng thái hiện tại')}</dt>
              <dd className="m-0 text-right font-semibold">
                {t(ORDER_STATUS_LABELS[order.status] ?? 'Không xác định')}
              </dd>
            </dl>
          </section>

          <div className="mt-3 rounded-lg border border-[#f3d08c] bg-[#fff2d9] p-3">
            <p className="m-0 font-bold">{t('⚠ Lưu ý')}</p>
            <p className="mb-0 mt-1 text-[#8b7867]">{t('Hủy đơn sẽ bắt đầu xử lý hoàn tiền.')}</p>
          </div>

          <div className="mt-3">
            <label htmlFor="cancel-order-reason" className="mb-1.5 block font-bold">
              {t('Lý do hủy')}
              <span className="text-red-600">*</span>
            </label>

            <textarea
              id="cancel-order-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 200))}
              required
              maxLength={200}
              rows={4}
              disabled={isSubmitting}
              placeholder={t('Nhập lý do hủy đơn')}
              className="w-full rounded-lg border border-[#ecd4b2] bg-transparent p-3 outline-none focus:border-[#a8754f] disabled:opacity-60"
            />

            <p className="m-0 text-right text-[9px] text-[#9a8c7c]">{reason.length}/200</p>

            {error && (
              <p role="alert" className="mt-1 text-red-600">
                {t(error)}
              </p>
            )}
          </div>

          <footer className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!submitting.current) onClose();
              }}
              className="h-9 cursor-pointer rounded-lg border border-[#ecd4b2] px-4 font-bold hover:bg-[#f6e9d4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('Đóng')}
            </button>

            <button
              type="submit"
              disabled={!reason.trim() || isSubmitting}
              className={`h-9 rounded-lg px-4 font-bold text-white transition-colors duration-200 ${
                !reason.trim() || isSubmitting
                  ? 'cursor-not-allowed bg-red-300'
                  : 'cursor-pointer bg-red-600 hover:bg-red-500 active:bg-red-700'
              }`}
            >
              {isSubmitting ? t('Đang xử lý...') : t('Xác nhận hủy')}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
