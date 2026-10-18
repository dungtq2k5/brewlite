'use client';
import { useStaffI18n } from '../i18n';
import { useEffect, useRef } from 'react';
import { getOrderBadgeClass, ORDER_STATUS_LABELS } from './order.constants';
import type { Order } from './order.types';
type OrderDetailsDrawerProps = {
  order: Order;
  onClose: () => void;
};
export function OrderDetailsDrawer({ order, onClose }: OrderDetailsDrawerProps) {
  const { t, name, money, dateTime } = useStaffI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
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
      aria-labelledby="staff-order-title"
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[360px] overflow-y-auto border-0 border-l border-[#e5d5c2] bg-[#fffcf7] p-5 text-[11px] text-[#734932] shadow-[-12px_0_40px_#2d1d1426] backdrop:bg-[#2d1d1473] sm:p-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[9px] uppercase tracking-[0.12em] text-[#9a8c7c]">
            {t('Chi tiết đơn')}
          </p>
          <h2 id="staff-order-title" className="mb-0 mt-1 text-xl font-medium">
            #{order.orderNo}
          </h2>
        </div>

        <button
          type="button"
          aria-label={t('Đóng hộp thoại')}
          onClick={onClose}
          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#ecd4b2] bg-transparent text-xl leading-none hover:bg-[#f6e9d4] focus-visible:outline-2 focus-visible:outline-[#734932]"
        >
          ×
        </button>
      </header>

      <p
        className={`mb-4 mt-3 rounded-full px-2.5 py-1 text-[10px] ${getOrderBadgeClass(order.status)}`}
      >
        {t(ORDER_STATUS_LABELS[order.status] ?? 'Không xác định')}
      </p>

      <section className="border-b border-[#ead8c1] pb-4" aria-labelledby="order-info-title">
        <h3 id="order-info-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          {t('Thông tin đơn')}
        </h3>

        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[10px]">
          <dt className="text-[#9a8c7c]">{t('Mã đơn')}</dt>
          <dd className="m-0 text-right font-semibold">#{order.orderNo}</dd>

          <dt className="text-[#9a8c7c]">{t('Trạng thái')}</dt>
          <dd className="m-0 text-right font-semibold">
            {t(ORDER_STATUS_LABELS[order.status] ?? 'Không xác định')}
          </dd>

          <dt className="text-[#9a8c7c]">{t('Thời gian tạo')}</dt>
          <dd className="m-0 text-right font-semibold">{dateTime(order.createdAt)}</dd>

          <dt className="text-[#9a8c7c]">{t('Thanh toán')}</dt>
          <dd className="m-0 text-right font-semibold">{dateTime(order.paidAt[0])}</dd>
        </dl>

        {order.note.length > 0 && (
          <div className="mt-3 rounded-lg bg-[#f3eadc] p-3">
            <p className="mb-1 mt-0 text-[9px] text-[#9a8c7c]">{t('Ghi chú khách hàng')}</p>
            <p className="m-0 break-words leading-relaxed">{order.note.join(' ')}</p>
          </div>
        )}

        {order.cancelNote.length > 0 && (
          <div className="mt-3 rounded-lg bg-[#fce9e3] p-3">
            <p className="mb-1 mt-0 text-[9px] text-[#9a8c7c]">{t('Lý do hủy')}</p>
            <p className="m-0 break-words leading-relaxed">{order.cancelNote.join(' ')}</p>
          </div>
        )}
      </section>

      <section className="border-b border-[#ead8c1] py-4" aria-labelledby="order-items-title">
        <h3 id="order-items-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          {t('Món và topping')}
        </h3>

        <ul className="m-0 list-none p-0">
          {order.lines.map((line, index) => (
            <li
              key={index}
              className="border-b border-dashed border-[#ead8c1] py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3 font-semibold">
                <span className="min-w-0 break-words leading-relaxed">
                  {name(line.productName)}
                </span>

                <span className="shrink-0 whitespace-nowrap">{money(line.lineTotalVnd)}</span>
              </div>

              <p className="mb-0 mt-1 text-[10px] leading-relaxed text-[#9a8c7c]">
                {t('Size')} {line.size} · x{line.qty} ·{' '}
                {line.toppings.length > 0
                  ? line.toppings.map((topping) => name(topping.name)).join(', ')
                  : t('Không topping')}
              </p>

              <p className="mb-0 mt-0.5 text-[10px] text-[#9a8c7c]">
                {t('Đơn giá:')} {money(line.unitPriceVnd)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-[#ead8c1] py-4" aria-labelledby="order-total-title">
        <h3 id="order-total-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          {t('Tổng tiền')}
        </h3>

        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[10px]">
          <dt className="text-[#9a8c7c]">{t('Tạm tính')}</dt>
          <dd className="m-0 text-right font-semibold">{money(order.subtotalVnd)}</dd>

          <dt className="text-[#9a8c7c]">{t('Mã khuyến mãi')}</dt>
          <dd className="m-0 text-right font-semibold">
            {order.promoCode.join(', ') || t('Không có')}
          </dd>

          <dt className="text-[#9a8c7c]">{t('Giảm theo mã')}</dt>
          <dd className="m-0 text-right font-semibold">{money(-order.promoDiscountVnd)}</dd>

          <dt className="text-[#9a8c7c]">{t('Giảm bằng điểm')}</dt>
          <dd className="m-0 text-right font-semibold">{money(-order.pointsDiscountVnd)}</dd>
        </dl>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ead8c1] pt-3">
          <span>{t('Tổng thanh toán')}</span>
          <strong className="text-base">{money(order.totalVnd)}</strong>
        </div>
      </section>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 h-10 w-full cursor-pointer rounded-lg border border-[#ecd4b2] bg-transparent font-semibold hover:bg-[#f6e9d4] focus-visible:outline-2 focus-visible:outline-[#734932]"
      >
        {t('Đóng')}
      </button>
    </dialog>
  );
}
