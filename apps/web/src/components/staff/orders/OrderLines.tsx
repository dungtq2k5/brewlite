'use client';
import { useStaffI18n } from '../i18n';
import type { OrderLine } from './order.types';
type OrderLinesProps = {
  lines: OrderLine[];
};
export function OrderLines({ lines }: OrderLinesProps) {
  const { t, name } = useStaffI18n();
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {lines.map((line, index) => (
        <li
          key={index}
          className="min-w-0 border-b border-dashed border-[#eadcca] pb-2 last:border-0 last:pb-0"
        >
          <div className="flex items-start justify-between gap-[5px] text-[11px] leading-[15px] text-[#6b4633]">
            <strong className="min-w-0 break-words font-bold">{name(line.productName)}</strong>

            <span className="flex-none whitespace-nowrap text-[#876b58]">
              {line.size} · x{line.qty}
            </span>
          </div>

          <p className="mb-0 mt-1 break-words text-[10px] leading-[14px] text-[#8b7867]">
            {t('Topping:')}{' '}
            {line.toppings.length > 0
              ? line.toppings.map((topping) => name(topping.name)).join(', ')
              : t('Không có')}
          </p>
        </li>
      ))}
    </ul>
  );
}
