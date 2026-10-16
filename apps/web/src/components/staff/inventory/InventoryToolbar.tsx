import type { InventoryTab, StatusFilter } from './inventory-api';
import styles from './Inventory.module.css';

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
  return (
    <>
      {/* 2 cái nút 'Sản phẩm - Topping' */}
      <div className={styles.tabs} role="tablist" aria-label="Loại tồn kho">
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
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'products'
                    : event.key === 'End'
                      ? 'toppings'
                      : tab === 'products'
                        ? 'toppings'
                        : 'products';
                onTabChange(next);
                document.getElementById(`inventory-tab-${next}`)?.focus();
              }
            }}
          >
            {value === 'products' ? 'Sản phẩm' : 'Topping'}
          </button>
        ))}
      </div>
      <div className={styles.toolbar}>
        {/* search */}
        <label className={styles.search}>
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
              tab === 'products' ? 'Tìm theo tên hoặc mã sản phẩm' : 'Tìm theo tên topping'
            }
            placeholder={tab === 'products' ? 'Tìm tên hoặc mã sản phẩm…' : 'Tìm tên topping…'}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        {/* button chọn */}
        <div className={styles.filters} role="group" aria-label="Lọc trạng thái bán">
          {(
            [
              ['all', 'Tất cả'],
              ['selling', 'Đang bật bán'],
              ['hidden', 'Đang tắt bán'],
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
