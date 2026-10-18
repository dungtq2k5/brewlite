'use client';
import { useStaffI18n } from '../i18n';
import type {
  InventoryProduct,
  InventoryTab,
  InventoryTopping,
  StatusFilter,
} from './inventory-api';
import { isProductAvailable } from './inventory-api';
type AvailabilityItem = {
  id: string;
  name: {
    en: string;
    vi: string;
  };
  isAvailable: boolean;
};
export function AvailabilityToggle({
  item,
  disabled,
  onChange,
}: {
  item: AvailabilityItem;
  disabled: boolean;
  onChange: (id: string, value: boolean) => void;
}) {
  const { t, name } = useStaffI18n();
  return (
    <button
      type="button"
      className="inline-flex h-[22px] w-[38px] flex-none items-center rounded-[20px] border-0 bg-[#c9bfb1] p-[3px] align-middle transition-colors aria-checked:bg-[#294536] disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#825c3d] [&[aria-checked='true']>span]:translate-x-4 motion-reduce:[&>span]:transition-none"
      role="switch"
      aria-checked={item.isAvailable}
      aria-label={t(item.isAvailable ? t('Tắt bán {name}') : t('Bật bán {name}'), {
        name: name(item.name),
      })}
      disabled={disabled}
      onClick={() => onChange(item.id, !item.isAvailable)}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_#0002] transition-transform duration-150" />
    </button>
  );
}
export function InventoryStatus({
  available,
  quantity,
}: {
  available: boolean;
  quantity?: number | null;
}) {
  const { t } = useStaffI18n();
  const empty = quantity === 0;
  const statusClass = empty
    ? 'bg-[#fae5df] text-[#ae3827]'
    : !available
      ? 'bg-[#eee7dd] text-[#756958]'
      : 'bg-[#dfe9df] text-[#2e523b]';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[20px] px-[9px] py-[5px] text-[10px] font-medium ${statusClass}`}
    >
      {empty
        ? t('Hết số lượng')
        : !available
          ? t('Đang tắt bán')
          : quantity == null
            ? t('Đang bật bán')
            : t('Còn hàng')}
    </span>
  );
}
interface Props {
  tab: InventoryTab;
  products: InventoryProduct[];
  toppings: InventoryTopping[];
  search: string;
  status: StatusFilter;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  onAvailability: (id: string, value: boolean) => void;
  onEdit: (product: InventoryProduct) => void;
}
export function InventoryTable({
  tab,
  products,
  toppings,
  search,
  status,
  loading,
  failed,
  busy,
  onAvailability,
  onEdit,
}: Props) {
  const { t, name, money, number } = useStaffI18n();
  const query = search.trim().toLocaleLowerCase('vi');
  function matches(item: AvailabilityItem) {
    const matchesSearch = `${item.name.vi} ${item.name.en}`.toLocaleLowerCase('vi').includes(query);
    const matchesStatus = status === 'all' || item.isAvailable === (status === 'selling');
    return matchesSearch && matchesStatus;
  }
  const filteredProducts = products.filter((item) => {
    const category = item.categoryId ?? '';
    const matchesSearch = `${item.name.vi} ${item.name.en} ${category} ${item.id}`
      .toLocaleLowerCase('vi')
      .includes(query);
    const matchesStatus = status === 'all' || isProductAvailable(item) === (status === 'selling');
    return matchesSearch && matchesStatus;
  });
  const filteredToppings = toppings.filter(matches);
  const count = tab === 'products' ? filteredProducts.length : filteredToppings.length;
  const columns =
    tab === 'products'
      ? [
          t('Tên sản phẩm'),
          t('Thể loại'),
          t('Số lượng'),
          t('Trạng thái'),
          t('Bật bán'),
          t('Thao tác'),
        ]
      : [t('Tên topping'), t('Giá'), t('Trạng thái'), t('Bật bán')];
  const tableClass =
    'm-0 w-full table-fixed border-separate border-spacing-0 text-left text-[12px]';
  const columnWidths =
    tab === 'products'
      ? ['w-[25%]', 'w-[15%]', 'w-[10%]', 'w-[15%]', 'w-[10%]', 'w-[25%]']
      : ['w-[55%]', 'w-[15%]', 'w-[15%]', 'w-[15%]'];
  const tableMinWidth =
    tab === 'products' ? 'min-w-[900px] max-[900px]:min-w-[850px]' : 'min-w-[520px]';
  return (
    <section
      id="inventory-panel"
      role="tabpanel"
      aria-labelledby={`inventory-tab-${tab}`}
      className="flex min-h-0 max-h-full w-full min-w-0 flex-[0_1_auto] flex-col self-start overflow-hidden rounded-xl border border-[#ead2b3] bg-[#fffcf7]"
    >
      <div className="flex min-h-0 max-h-full min-w-0 flex-[0_1_auto] flex-col overflow-hidden">
        <div
          className="min-h-0 min-w-0 flex-[0_1_auto] max-h-[calc(58px*7+41px)] overflow-auto overscroll-contain [scrollbar-color:#ccb89f_#fffcf7] [scrollbar-gutter:stable] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#825c3d]"
          role="region"
          aria-label={tab === 'products' ? t('Tồn kho sản phẩm') : t('Danh sách topping')}
          tabIndex={0}
          aria-busy={loading}
        >
          <table className={`${tableClass} ${tableMinWidth}`}>
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={index} className={width} />
              ))}
            </colgroup>

            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={t(column)}
                    scope="col"
                    className={`sticky top-0 z-1 box-border h-10 whitespace-nowrap border-b border-[#eadbc7] bg-[#f0e4d1] py-3 text-[10px] font-medium text-[#88735f] max-[900px]:py-[11px] ${
                      tab === 'products' && index === 5
                        ? 'px-[14px] text-center max-[900px]:px-[10px]'
                        : tab === 'products' && (index === 2 || index === 4)
                          ? 'pl-3 pr-[14px] text-left max-[900px]:pr-[10px]'
                          : 'px-[14px] text-left max-[900px]:px-[10px]'
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="h-[140px] border-b-0 px-[14px] py-3 text-center text-[#8c7864] max-[900px]:px-[10px] max-[900px]:py-[11px]"
                    colSpan={columns.length}
                    role="status"
                  >
                    {t('Đang tải dữ liệu…')}
                  </td>
                </tr>
              ) : count === 0 ? (
                <tr>
                  <td
                    className="h-[140px] border-b-0 px-[14px] py-3 text-center text-[#8c7864] max-[900px]:px-[10px] max-[900px]:py-[11px]"
                    colSpan={columns.length}
                  >
                    {failed
                      ? t('Chưa thể tải dữ liệu. Vui lòng làm mới để thử lại.')
                      : search || status !== 'all'
                        ? t('Không tìm thấy kết quả phù hợp.')
                        : tab === 'products'
                          ? t('Chưa có sản phẩm.')
                          : t('Chưa có topping.')}
                  </td>
                </tr>
              ) : tab === 'products' ? (
                filteredProducts.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#faf4e9] [&:last-child>th]:border-b-0 [&:last-child>td]:border-b-0"
                  >
                    <th
                      scope="row"
                      className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 text-left font-semibold [overflow-wrap:anywhere] max-[900px]:px-[10px] max-[900px]:py-[11px]"
                    >
                      {name(item.name)}
                    </th>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 font-semibold text-[#79543b] [overflow-wrap:anywhere] max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      {item.categoryId || '—'}
                    </td>

                    <td
                      className={`h-[58px] box-border border-b border-[#f0e5d6] py-3 pl-3 pr-[14px] font-semibold tabular-nums max-[900px]:pr-[10px] ${item.stockQty === 0 ? 'text-[#b94432]' : 'text-inherit'}`}
                    >
                      {item.stockQty === null ? (
                        <span
                          className="text-[11px] font-normal"
                          aria-label={t('Không theo dõi tồn kho')}
                        >
                          —
                        </span>
                      ) : (
                        number(item.stockQty)
                      )}
                    </td>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      <InventoryStatus available={item.isAvailable} quantity={item.stockQty} />
                    </td>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] py-3 pl-3 pr-[14px] max-[900px]:pr-[10px]">
                      <AvailabilityToggle
                        item={{
                          ...item,
                          isAvailable: isProductAvailable(item),
                        }}
                        disabled={busy || item.stockQty === 0}
                        onChange={onAvailability}
                      />
                    </td>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 text-center max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      <button
                        type="button"
                        className="inline-flex min-h-8 w-full box-border items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border border-[#ead2b3] bg-[#fffcf7] px-3 py-[6px] text-[11px] font-semibold text-[#68432f] hover:bg-[#f2e5d3] disabled:cursor-wait disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#825c3d]"
                        disabled={busy}
                        aria-label={t('Chỉnh số lượng {name}', { name: name(item.name) })}
                        onClick={() => onEdit(item)}
                      >
                        {t('Chỉnh số lượng')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                filteredToppings.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#faf4e9] [&:last-child>th]:border-b-0 [&:last-child>td]:border-b-0"
                  >
                    <th
                      scope="row"
                      className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 text-left font-semibold [overflow-wrap:anywhere] max-[900px]:px-[10px] max-[900px]:py-[11px]"
                    >
                      {name(item.name)}
                    </th>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      {money(item.priceVnd)}
                    </td>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      <InventoryStatus available={item.isAvailable} />
                    </td>

                    <td className="h-[58px] box-border border-b border-[#f0e5d6] px-[14px] py-3 max-[900px]:px-[10px] max-[900px]:py-[11px]">
                      <AvailabilityToggle item={item} disabled={busy} onChange={onAvailability} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
