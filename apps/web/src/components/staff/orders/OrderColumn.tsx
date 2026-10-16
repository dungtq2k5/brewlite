'use client';

import { useState } from 'react';
import { DEFAULT_VISIBLE_ORDERS, LOAD_MORE_ORDERS } from './order.constants';
import { OrderCard } from './OrderCard';
import type { Order, OrderColumnConfig } from './order.types';

type OrderColumnProps = {
  column: OrderColumnConfig;
  orders: Order[];
  onDetails: (orderId: string) => void;
  onAdvance: (orderId: string) => void;
  onCancel: (orderId: string) => void;
};

export function OrderColumn({ column, orders, onDetails, onAdvance, onCancel }: OrderColumnProps) {
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_ORDERS);

  const visibleOrders = orders.slice(0, visibleCount);
  const hiddenCount = orders.length - visibleOrders.length;
  const nextLoadCount = Math.min(LOAD_MORE_ORDERS, hiddenCount);
  const isExpanded = visibleOrders.length > DEFAULT_VISIBLE_ORDERS;
  const listId = `orders-${column.status}`;

  return (
    <section
      className="min-w-0 rounded-xl border border-[#ecd3ad] bg-[#f6e9d4] px-2 py-[9px]"
      aria-label={column.title}
    >
      <div className="mx-[2px] mb-2 mt-0 flex h-5 items-center justify-between gap-2">
        <h2 className="m-0 text-[10px] font-bold text-[#734d33]">{column.title}</h2>
      </div>

      <div
        id={listId}
        className="grid max-h-[60dvh] min-h-0 auto-rows-max content-start gap-2 overflow-y-auto overscroll-y-contain"
      >
        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            column={column}
            onDetails={onDetails}
            onAdvance={onAdvance}
            onCancel={onCancel}
          />
        ))}

        {orders.length === 0 && (
          <p className="mx-1 my-[6px] text-[10px] text-[#8d7864]">
            Không có đơn trong trạng thái này.
          </p>
        )}
      </div>

      {orders.length > 0 && (
        <div className="mt-2 grid gap-[6px]">
          <p
            className="m-0 text-center text-[9px] leading-[14px] text-[#8d7864]"
            aria-live="polite"
          >
            Hiển thị {visibleOrders.length}/{orders.length} đơn
            {hiddenCount > 0 && ` · Còn ${hiddenCount} đơn`}
          </p>

          {hiddenCount > 0 && (
            <button
              type="button"
              className="min-h-[30px] w-full cursor-pointer rounded-[7px] border border-[#ecd3ad] bg-[#fffcf7] px-[10px] py-[6px] font-[Arial,Helvetica,sans-serif] text-[10px] font-bold text-[#69462f] hover:bg-[#f8eddd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#734d33]"
              onClick={() =>
                setVisibleCount((current) => Math.min(current + LOAD_MORE_ORDERS, orders.length))
              }
              aria-controls={listId}
            >
              Xem thêm {nextLoadCount} đơn
            </button>
          )}

          {isExpanded && (
            <button
              type="button"
              className="min-h-[30px] w-full cursor-pointer rounded-[7px] border border-[#ecd3ad] bg-transparent px-[10px] py-[6px] font-[Arial,Helvetica,sans-serif] text-[10px] font-normal text-[#69462f] hover:bg-[#f8eddd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#734d33]"
              onClick={() => setVisibleCount(DEFAULT_VISIBLE_ORDERS)}
              aria-controls={listId}
            >
              Thu gọn
            </button>
          )}
        </div>
      )}
    </section>
  );
}
