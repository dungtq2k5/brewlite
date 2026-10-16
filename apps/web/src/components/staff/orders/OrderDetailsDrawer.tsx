'use client';

import { useEffect, useRef } from 'react';
import { getOrderBadgeClass, ORDER_STATUS_LABELS } from './order.constants';
import type { Order } from './order.types';

type OrderDetailsDrawerProps = {
  order: Order;
  onClose: () => void;
};

const formatVnd = (value: number) => `${value.toLocaleString('vi-VN')} đ`;

export function OrderDetailsDrawer({ order, onClose }: OrderDetailsDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const subtotalVnd = order.lines.reduce(
    (sum, line) => sum + (line.lineTotalVnd ?? (line.unitPriceVnd ?? 0) * line.quantity),
    0,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
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
          <p className="m-0 text-[9px] uppercase tracking-[0.12em] text-[#9a8c7c]">Chi tiết đơn</p>
          <h2 id="staff-order-title" className="mb-0 mt-1 text-xl font-medium">
            #{order.id}
          </h2>
        </div>

        <button
          type="button"
          aria-label="Đóng chi tiết đơn"
          onClick={onClose}
          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#ecd4b2] bg-transparent text-xl leading-none hover:bg-[#f6e9d4] focus-visible:outline-2 focus-visible:outline-[#734932]"
        >
          ×
        </button>
      </header>

      <p
        className={`mb-4 mt-3 rounded-full px-2.5 py-1 text-[10px] ${getOrderBadgeClass(order.status)}`}
      >
        {ORDER_STATUS_LABELS[order.status]}
      </p>

      <section className="border-b border-[#ead8c1] pb-4" aria-labelledby="order-info-title">
        <h3 id="order-info-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          Thông tin đơn
        </h3>

        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[10px]">
          <dt className="text-[#9a8c7c]">Mã đơn</dt>
          <dd className="m-0 text-right font-semibold">#{order.id}</dd>

          <dt className="text-[#9a8c7c]">Trạng thái</dt>
          <dd className="m-0 text-right font-semibold">{ORDER_STATUS_LABELS[order.status]}</dd>

          <dt className="text-[#9a8c7c]">Thời gian tạo</dt>
          <dd className="m-0 text-right font-semibold">{order.time}</dd>

          <dt className="text-[#9a8c7c]">Thanh toán</dt>
          <dd className="m-0 text-right font-semibold">{order.paidAt}</dd>
        </dl>

        {order.note && (
          <div className="mt-3 rounded-lg bg-[#f3eadc] p-3">
            <p className="mb-1 mt-0 text-[9px] text-[#9a8c7c]">Ghi chú khách hàng</p>
            <p className="m-0 break-words leading-relaxed">{order.note}</p>
          </div>
        )}

        {order.cancelReason && (
          <div className="mt-3 rounded-lg bg-[#fce9e3] p-3">
            <p className="mb-1 mt-0 text-[9px] text-[#9a8c7c]">Lý do hủy</p>
            <p className="m-0 break-words leading-relaxed">{order.cancelReason}</p>
          </div>
        )}
      </section>

      <section className="border-b border-[#ead8c1] py-4" aria-labelledby="order-items-title">
        <h3 id="order-items-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          Món và topping
        </h3>

        <ul className="m-0 list-none p-0">
          {order.lines.map((line) => (
            <li
              key={line.id}
              className="border-b border-dashed border-[#ead8c1] py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3 font-semibold">
                <span className="min-w-0 break-words leading-relaxed">{line.item}</span>

                <span className="shrink-0 whitespace-nowrap">
                  {formatVnd(line.lineTotalVnd ?? (line.unitPriceVnd ?? 0) * line.quantity)}
                </span>
              </div>

              <p className="mb-0 mt-1 text-[10px] leading-relaxed text-[#9a8c7c]">
                Size {line.size} · x{line.quantity} ·{' '}
                {line.toppings.length > 0
                  ? line.toppings.map((topping) => topping.name).join(', ')
                  : 'Không topping'}
              </p>

              <p className="mb-0 mt-0.5 text-[10px] text-[#9a8c7c]">
                Đơn giá: {formatVnd(line.unitPriceVnd ?? 0)}
              </p>

              {line.note && (
                <p className="mb-0 mt-1 text-[10px] leading-relaxed">Ghi chú: {line.note}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-b border-[#ead8c1] py-4" aria-labelledby="order-total-title">
        <h3 id="order-total-title" className="mb-3 mt-0 text-xs font-medium uppercase">
          Tổng tiền
        </h3>

        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[10px]">
          <dt className="text-[#9a8c7c]">Tạm tính</dt>
          <dd className="m-0 text-right font-semibold">{formatVnd(subtotalVnd)}</dd>

          <dt className="text-[#9a8c7c]">Mã khuyến mãi</dt>
          <dd className="m-0 text-right font-semibold">{order.promoCode ?? 'Không có'}</dd>

          <dt className="text-[#9a8c7c]">Giảm theo mã</dt>
          <dd className="m-0 text-right font-semibold">
            {formatVnd(-(order.promoDiscountVnd ?? 0))}
          </dd>

          <dt className="text-[#9a8c7c]">Giảm bằng điểm</dt>
          <dd className="m-0 text-right font-semibold">
            {formatVnd(-(order.pointsDiscountVnd ?? 0))}
          </dd>
        </dl>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#ead8c1] pt-3">
          <span>Tổng thanh toán</span>
          <strong className="text-base">{order.total}</strong>
        </div>
      </section>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 h-10 w-full cursor-pointer rounded-lg border border-[#ecd4b2] bg-transparent font-semibold hover:bg-[#f6e9d4] focus-visible:outline-2 focus-visible:outline-[#734932]"
      >
        Đóng
      </button>
    </dialog>
  );
}
