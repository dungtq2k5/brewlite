'use client';

import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_LABELS } from './order.constants';
import type { Order } from './order.types';

type CancelOrderDialogProps = {
  order: Order;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function CancelOrderDialog({ order, onClose, onConfirm }: CancelOrderDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');

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
      aria-labelledby="cancel-order-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[388px] overflow-y-auto rounded-2xl border-0 bg-[#fffcf7] p-5 text-[11px] text-[#734932] shadow-2xl backdrop:bg-[#2d1d1473] sm:p-6"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();

          const trimmedReason = reason.trim();
          if (!trimmedReason || trimmedReason.length > 200) return;

          onConfirm(trimmedReason);
        }}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[9px] uppercase tracking-[0.12em] text-[#9a8c7c]">
              Xác nhận thao tác
            </p>
            <h2 id="cancel-order-title" className="mb-0 mt-1 text-xl font-medium">
              Hủy đơn #{order.id}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng popup"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#ecd4b2] text-xl hover:bg-[#f6e9d4]"
          >
            ×
          </button>
        </header>

        <section className="mt-3 rounded-xl bg-[#f5ecdf] p-3">
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
            <dt className="text-[#9a8c7c]">Mã đơn</dt>
            <dd className="m-0 text-right font-semibold">#{order.id}</dd>

            <dt className="text-[#9a8c7c]">Tổng đã thanh toán</dt>
            <dd className="m-0 text-right font-semibold">{order.total}</dd>

            <dt className="text-[#9a8c7c]">Trạng thái hiện tại</dt>
            <dd className="m-0 text-right font-semibold">{ORDER_STATUS_LABELS[order.status]}</dd>
          </dl>
        </section>

        <div className="mt-3 rounded-lg border border-[#f3d08c] bg-[#fff2d9] p-3">
          <p className="m-0 font-bold">⚠ Lưu ý</p>
          <p className="mb-0 mt-1 text-[#8b7867]">
            Đây là dữ liệu mẫu. Thao tác chưa thực hiện hoàn tiền.
          </p>
        </div>

        <div className="mt-3">
          <label htmlFor="cancel-order-reason" className="mb-1.5 block font-bold">
            Lý do hủy <span className="text-red-600">*</span>
          </label>

          <textarea
            id="cancel-order-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 200))}
            required
            maxLength={200}
            rows={4}
            placeholder="Nhập lý do hủy đơn"
            className="w-full rounded-lg border border-[#ecd4b2] bg-transparent p-3 outline-none focus:border-[#a8754f]"
          />

          <p className="m-0 text-right text-[9px] text-[#9a8c7c]">{reason.length}/200</p>
        </div>

        <footer className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-lg border border-[#ecd4b2] px-4 font-bold hover:bg-[#f6e9d4]"
          >
            Đóng
          </button>

          <button
            type="submit"
            disabled={!reason.trim()}
            className="h-9 cursor-pointer rounded-lg bg-[#e9a79a] px-4 font-bold text-white hover:bg-[#d98d7e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xác nhận hủy
          </button>
        </footer>
      </form>
    </dialog>
  );
}
