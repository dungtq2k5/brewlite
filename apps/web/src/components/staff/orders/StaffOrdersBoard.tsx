'use client';

import { useState } from 'react';
import { StaffIcon } from '../StaffIcon';
import { CancelOrderDialog } from './CancelOrderDialog';
import { ORDER_COLUMNS } from './order.constants';
import { OrderColumn } from './OrderColumn';
import { OrderDetailsDrawer } from './OrderDetailsDrawer';
import { OrderSummary } from './OrderSummary';
import { OrderToolbar } from './OrderToolbar';
import { useStaffOrders } from './useStaffOrders';
import type { OrderFilter } from './order.types';

type ActiveDialog =
  { type: 'details'; orderId: string } | { type: 'cancel'; orderId: string } | null;

export function StaffOrdersBoard() {
  const { orders, stats, notice, advanceOrder, cancelOrder, refreshOrders } = useStaffOrders();

  const [filter, setFilter] = useState<OrderFilter>('all');
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  // Thay key khi refresh để reset số đơn đang hiện ở các cột.
  const [refreshVersion, setRefreshVersion] = useState(0);

  const activeOrder = activeDialog
    ? orders.find((order) => order.id === activeDialog.orderId)
    : undefined;

  const visibleColumns = ORDER_COLUMNS.filter(
    (column) => filter === 'all' || filter === column.status,
  );

  function handleRefresh() {
    setActiveDialog(null);
    setFilter('all');
    setRefreshVersion((current) => current + 1);
    refreshOrders();
  }

  function handleConfirmCancel(reason: string) {
    if (activeDialog?.type !== 'cancel' || !activeOrder) return;
    if (activeOrder.status !== 'PAID') return;

    cancelOrder(activeOrder.id, reason);
    setActiveDialog(null);
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-[18px]">
        <div>
          <h1 className="m-0 text-[19px] font-bold leading-[24px] tracking-[-0.3px] text-[#62402b]">
            Đơn đang xử lý
          </h1>
          <p className="mb-0 mt-[7px] text-[9px] leading-[13px] text-[#988879]">
            {stats.processing} đơn đang xử lý
          </p>
        </div>

        <button
          type="button"
          className="flex h-[34px] cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[#ecd4b2] bg-[#fffcf7] px-[15px] py-0 font-[Arial,Helvetica,sans-serif] text-[10px] font-bold text-[#65412b] hover:bg-[#faebd7] [&_svg]:h-3 [&_svg]:w-3"
          onClick={handleRefresh}
        >
          <StaffIcon name="refresh" />
          Làm mới
        </button>
      </div>

      <OrderSummary stats={stats} />

      <OrderToolbar filter={filter} onFilterChange={setFilter} connectionLabel="Dữ liệu mẫu" />

      <div
        className={`mt-[11px] grid items-start gap-[11px] ${
          filter === 'all'
            ? 'grid-cols-3 max-[950px]:grid-cols-2 max-[650px]:grid-cols-1'
            : 'grid-cols-[minmax(0,285px)] max-[950px]:grid-cols-1'
        }`}
      >
        {visibleColumns.map((column) => (
          <OrderColumn
            key={`${refreshVersion}-${column.status}`}
            column={column}
            orders={orders.filter((order) => order.status === column.status)}
            onDetails={(orderId) => setActiveDialog({ type: 'details', orderId })}
            onAdvance={advanceOrder}
            onCancel={(orderId) => setActiveDialog({ type: 'cancel', orderId })}
          />
        ))}
      </div>

      {notice && (
        <p className="mb-0 mt-3 text-[10px] text-[#725844]" role="status">
          {notice}
        </p>
      )}

      {activeDialog?.type === 'details' && activeOrder && (
        <OrderDetailsDrawer
          key={activeOrder.id}
          order={activeOrder}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {activeDialog?.type === 'cancel' && activeOrder?.status === 'PAID' && (
        <CancelOrderDialog
          key={activeOrder.id}
          order={activeOrder}
          onClose={() => setActiveDialog(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
