'use client';
import { useStaffI18n } from '../i18n';
import type { InventoryTab, StatusFilter } from './inventory-api';
interface Props {
  busy: boolean;
  tab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
  search: string;
  onSearchChange: (search: string) => void;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}
export function InventoryToolbar({
  busy,
  tab,
  onTabChange,
  search,
  onSearchChange,
  status,
  onStatusChange,
}: Props) {
  const { t } = useStaffI18n();
  return (
    <>
      <div
        className="flex shrink-0 gap-[22px] border-b border-[#e8d6ba] [&_button]:cursor-pointer [&_button]:border-0 [&_button]:border-b-2 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-[3px] [&_button]:pb-3 [&_button]:text-xs [&_button]:text-[#8a7967] [&_button[aria-selected=true]]:border-[#795236] [&_button[aria-selected=true]]:font-semibold [&_button[aria-selected=true]]:text-[#68432f]"
        role="tablist"
        aria-label={t('Loại tồn kho')}
      >
        {(['products', 'toppings'] as const).map((value) => (
          <button
            key={value}
            id={`inventory-tab-${value}`}
            role="tab"
            disabled={busy}
            aria-selected={tab === value}
            aria-controls="inventory-panel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => onTabChange(value)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 'products'
                  : event.key === 'End'
                    ? 'toppings'
                    : value === 'products'
                      ? 'toppings'
                      : 'products';
              onTabChange(next);
              document.getElementById(`inventory-tab-${next}`)?.focus();
            }}
          >
            {value === 'products' ? t('Sản phẩm') : t('Topping')}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 max-[650px]:flex-col max-[650px]:items-stretch max-[650px]:gap-[10px]">
        <label className="flex w-[285px] max-w-full items-center gap-[9px] rounded-[9px] border border-[#ead2b3] bg-[#fffcf7] px-3 text-[#9a8874] focus-within:border-[#825c3d] focus-within:shadow-[0_0_0_2px_rgb(130_92_61/12%)] max-[650px]:box-border max-[650px]:w-full [&_svg]:size-4 [&_svg]:shrink-0 [&_input]:h-[38px] [&_input]:w-full [&_input]:min-w-0 [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-xs [&_input]:text-[#68432f] [&_input]:outline-none [&_input]:shadow-none [&_input]:placeholder:text-[#a08b78]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            type="search"
            aria-label={
              tab === 'products' ? t('Tìm theo tên hoặc mã sản phẩm') : t('Tìm theo tên topping')
            }
            placeholder={
              tab === 'products' ? t('Tìm tên hoặc mã sản phẩm…') : t('Tìm tên topping…')
            }
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div
          className="flex shrink-0 gap-0.5 rounded-[9px] border border-[#ead2b3] p-[3px] max-[650px]:self-start [&_button]:cursor-pointer [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[10px] [&_button]:py-[7px] [&_button]:text-[11px] [&_button]:whitespace-nowrap [&_button]:text-[#85715e] [&_button[aria-pressed=true]]:bg-[#68412b] [&_button[aria-pressed=true]]:text-[#fffaf3]"
          role="group"
          aria-label={t('Lọc trạng thái bán')}
        >
          {(
            [
              ['all', t('Tất cả')],
              ['selling', t('Đang bật bán')],
              ['hidden', t('Đang tắt bán')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => onStatusChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
