import { StaffIcon } from '../StaffIcon';
import { ORDER_FILTERS } from './order.constants';
import type { OrderFilter } from './order.types';

type OrderToolbarProps = {
  filter: OrderFilter;
  onFilterChange: (filter: OrderFilter) => void;
  connectionLabel: string;
};

export function OrderToolbar({ filter, onFilterChange, connectionLabel }: OrderToolbarProps) {
  return (
    <div className="mt-4 flex min-h-[31px] items-center justify-between gap-[10px] max-[650px]:items-start max-[420px]:flex-col">
      <div
        className="flex min-h-[29px] items-center gap-px rounded-[9px] border border-[#ecd6b7] bg-[#f9f0e2] p-[3px] max-[420px]:w-full max-[420px]:justify-between"
        role="group"
        aria-label="Lọc đơn hàng"
      >
        {ORDER_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={`grid min-h-[23px] cursor-pointer place-items-center whitespace-nowrap rounded-[5px] border-0 px-[9px] py-0 font-[Arial,Helvetica,sans-serif] text-[9px] max-[420px]:px-[7px] max-[420px]:text-[8px] ${
              filter === value
                ? 'bg-[#5d3b27] font-bold text-[#fffaf2] shadow-[0_1_2px_#44271629]'
                : 'bg-transparent font-normal text-[#8b7b6d] hover:bg-[#f1dfc6] hover:text-[#5d3b27]'
            }`}
            onClick={() => onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <span
        className="flex items-center gap-[5px] whitespace-nowrap text-[8px] text-[#425e4e] [&_svg]:h-3 [&_svg]:w-3 max-[650px]:mt-2 max-[420px]:mt-0 max-[420px]:self-end"
        role="status"
      >
        <StaffIcon name="wifi" />
        {connectionLabel}
      </span>
    </div>
  );
}
