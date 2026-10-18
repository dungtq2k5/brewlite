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
import type { Order, OrderFilter } from './order.types';
import type { Result, StaffPermission } from '@/lib/staff/contracts';
import { useStaffI18n } from '../i18n';
type ActiveDialog =
  | {
      type: 'details';
      orderId: string;
    }
  | {
      type: 'cancel';
      orderId: string;
    }
  | null;
export function StaffOrdersBoard({
  initial,
  permissions,
}: {
  initial: Result<Order[]>;
  permissions: StaffPermission[];
}) {
  const { t } = useStaffI18n();
  const { orders, stats, notice, error, busy, advanceOrder, cancelOrder, refreshOrders } =
    useStaffOrders(initial);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [cancelledOrder, setCancelledOrder] = useState<Order | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const activeOrder = activeDialog
    ? (orders.find((order) => order.id === activeDialog.orderId) ?? cancelledOrder)
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
  async function handleConfirmCancel(reason: string) {
    if (activeDialog?.type !== 'cancel' || !activeOrder) {
      throw new Error('notFound');
    }
    if (activeOrder.status !== 'PAID') {
      throw new Error('invalidState');
    }
    return cancelOrder(activeOrder.id, reason);
  }
  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-[18px]">
        <div>
          <h1 className="m-0 text-[25px] font-bold leading-[24px] tracking-[-0.3px] text-[#62402b]">
            {t('Đơn đang xử lý')}
          </h1>
          <p className="mb-0 mt-[7px] text-[9px] leading-[13px] text-[#988879]">
            {t('{count} đơn đang xử lý', { count: stats.processing })}
          </p>
        </div>

        <button
          type="button"
          className="flex h-[34px] cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[#ecd4b2] bg-[#fffcf7] px-[15px] py-0 font-[Arial,Helvetica,sans-serif] text-[10px] font-bold text-[#65412b] hover:bg-[#faebd7] [&_svg]:h-3 [&_svg]:w-3"
          disabled={busy}
          onClick={handleRefresh}
        >
          <StaffIcon name="refresh" />
          {t('Làm mới')}
        </button>
      </div>

      <OrderSummary stats={stats} />

      <OrderToolbar
        filter={filter}
        onFilterChange={setFilter}
        connectionLabel={t(busy ? 'Đang tải…' : 'Dữ liệu từ máy chủ')}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-[#fff0eb] p-3 text-xs text-[#a13d2b]">
          {t(error)}
        </p>
      )}

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
            busy={busy || !initial.ok}
            canAdvance={permissions.includes('order.status.update')}
            canCancel={permissions.includes('order.cancel.paid')}
            orders={orders.filter((order) => order.status === column.status)}
            onDetails={(orderId) => setActiveDialog({ type: 'details', orderId })}
            onAdvance={advanceOrder}
            onCancel={(orderId) => setActiveDialog({ type: 'cancel', orderId })}
          />
        ))}
      </div>

      {notice && (
        <p className="mb-0 mt-3 text-[10px] text-[#725844]" role="status">
          {t(notice)}
        </p>
      )}

      {activeDialog?.type === 'details' && activeOrder && (
        <OrderDetailsDrawer
          key={activeOrder.id}
          order={activeOrder}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {activeDialog?.type === 'cancel' && activeOrder && (
        <CancelOrderDialog
          key={activeOrder.id}
          order={cancelledOrder ?? activeOrder}
          onClose={() => {
            setActiveDialog(null);
            setCancelledOrder(null);
          }}
          onConfirm={async (reason) => {
            const updated = await handleConfirmCancel(reason);
            setCancelledOrder(updated);
          }}
        />
      )}
    </div>
  );
}
