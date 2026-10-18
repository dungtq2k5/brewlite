'use client';
import { useStaffI18n } from '../i18n';
import { getOrderBadgeClass } from './order.constants';
import { OrderLines } from './OrderLines';
import type { Order, OrderColumnConfig } from './order.types';
type OrderCardProps = {
  order: Order;
  column: OrderColumnConfig;
  busy: boolean;
  canAdvance: boolean;
  canCancel: boolean;
  onDetails: (orderId: string) => void;
  onAdvance: (orderId: string) => void;
  onCancel: (orderId: string) => void;
};
export function OrderCard({
  order,
  column,
  busy,
  canAdvance,
  canCancel,
  onDetails,
  onAdvance,
  onCancel,
}: OrderCardProps) {
  const { t, money, dateTime } = useStaffI18n();
  return (
    <article className="min-w-0 rounded-[9px] border border-[#ead5b9] bg-[#fffcf7] px-[10px] py-[9px] shadow-[0_2px_4px_#76513a0b]">
      <div className="flex min-h-[19px] items-center justify-between gap-[7px]">
        <strong className="text-[15px] font-extrabold text-[#6e452e]">#{order.orderNo}</strong>

        <span
          className={`grid min-h-[19px] place-items-center whitespace-nowrap rounded-[11px] px-[7px] py-0 text-[8px] ${getOrderBadgeClass(order.status)}`}
        >
          {t(column.title)}
        </span>
      </div>

      <p className="mb-0 mt-[1px] whitespace-nowrap text-[9px] leading-[11px] text-[#a2978a]">
        {t('Tạo lúc')} {dateTime(order.createdAt)} · {t('Thanh toán')} {dateTime(order.paidAt[0])}
      </p>

      <div className="my-[7px] h-px border-t border-dashed border-[#eadcca]" />

      <OrderLines lines={order.lines} />

      {order.note.length > 0 && (
        <p className="mb-0 mt-2 rounded-[5px] bg-[#f2ece4] px-2 py-2 text-[11px] leading-[15px] text-[#91806f]">
          {t('Ghi chú:')} {order.note.join(' ')}
        </p>
      )}

      <div className="flex min-h-[29px] items-center justify-between text-[10px] text-[#8b7867]">
        <span>{t('Tổng')}</span>
        <strong className="text-[15px] font-extrabold text-[#734932]">
          {money(order.totalVnd)}
        </strong>
      </div>

      <div className="flex gap-1 [&_button]:grid [&_button]:h-[38px] [&_button]:min-w-0 [&_button]:flex-1 [&_button]:cursor-pointer [&_button]:place-items-center [&_button]:rounded-[7px] [&_button]:px-[5px] [&_button]:py-0 [&_button]:font-[Arial,Helvetica,sans-serif] [&_button]:text-[9px] [&_button]:font-bold [&_button]:whitespace-nowrap">
        <button
          type="button"
          className="border border-[#edd4b2] bg-[#fffcf7] text-[#69462f] hover:bg-[#f8eddd]"
          onClick={() => onDetails(order.id)}
        >
          {t('Chi tiết')}
        </button>

        {canAdvance && (
          <button
            type="button"
            disabled={busy}
            className="border border-[#5c3a26] bg-[#5c3a26] text-[#fffaf2] hover:bg-[#764b31]"
            onClick={() => onAdvance(order.id)}
          >
            {t(column.action)}
          </button>
        )}

        {order.status === 'PAID' && canCancel && (
          <button
            type="button"
            className="border border-[#ce4e38] bg-[#ce4e38] text-[#fffaf2] hover:bg-[#b93f2f]"
            disabled={busy}
            onClick={() => onCancel(order.id)}
          >
            {t('Hủy đơn')}
          </button>
        )}
      </div>
    </article>
  );
}
