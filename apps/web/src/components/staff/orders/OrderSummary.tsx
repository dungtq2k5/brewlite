'use client';
import { useStaffI18n } from '../i18n';
import { StaffIcon } from '../StaffIcon';
import type { OrderStats } from './order.types';
type OrderSummaryProps = {
  stats: OrderStats;
};
export function OrderSummary({ stats }: OrderSummaryProps) {
  const { t } = useStaffI18n();
  const items = [
    {
      label: t('Đã thanh toán'),
      value: stats.paid,
      icon: 'credit-card',
      tone: 'bg-[#F0E5D4] text-[#835B38]',
    },
    {
      label: t('Đang pha'),
      value: stats.preparing,
      icon: 'coffee',
      tone: 'bg-[#E9EEE2] text-[#5E7959]',
    },
    {
      label: t('Chờ nhận'),
      value: stats.ready,
      icon: 'check-circle',
      tone: 'bg-[#F5EAD7] text-[#B27D39]',
    },
  ] as const;
  return (
    <section className="grid grid-cols-3 gap-2.5 sm:gap-3.5" aria-label={t('Tóm tắt đơn hàng')}>
      {items.map((item) => (
        <article
          key={t(item.label)}
          className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto] items-center gap-x-2 rounded-xl border border-[#E5D7C4] bg-[#FFFAF1] p-2.5 sm:gap-x-3 sm:p-4"
        >
          <span
            className={`mb-2 grid size-8 place-items-center self-end rounded-lg sm:size-9 ${item.tone}`}
          >
            <StaffIcon name={item.icon} />
          </span>

          <strong className="row-span-2 justify-self-end text-right text-xl leading-tight text-[#4E3427] tabular-nums sm:text-2xl">
            {item.value}
          </strong>

          <p className="min-w-0 self-start text-[9px] leading-tight text-[#887764] sm:text-[11px]">
            {item.label}
          </p>
        </article>
      ))}
    </section>
  );
}
