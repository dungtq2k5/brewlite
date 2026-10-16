import type {
  InventoryProduct,
  InventoryTab,
  InventoryTopping,
  StatusFilter,
} from './inventory-api';
import styles from './Inventory.module.css';

export function AvailabilityToggle({
  item,
  disabled,
  onChange,
}: {
  item: InventoryTopping;
  disabled: boolean;
  onChange: (id: string, value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={styles.toggle}
      role="switch"
      aria-checked={item.isAvailable}
      aria-label={`Bật bán ${item.name.vi || item.name.en}`}
      disabled={disabled}
      onClick={() => onChange(item.id, !item.isAvailable)}
    >
      <span />
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
  const empty = quantity === 0;
  return (
    <span
      className={`${styles.badge} ${empty ? styles.soldOut : available ? styles.available : styles.unavailable}`}
    >
      {empty
        ? 'Hết số lượng'
        : !available
          ? 'Đang tắt bán'
          : quantity == null
            ? 'Đang bật bán'
            : 'Còn hàng'}
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
  const query = search.trim().toLocaleLowerCase('vi');
  function matches(item: InventoryTopping, code = '') {
    return (
      `${item.name.vi} ${item.name.en} ${code}`.toLocaleLowerCase('vi').includes(query) &&
      (status === 'all' || item.isAvailable === (status === 'selling'))
    );
  }
  const filteredProducts = products.filter((item) => matches(item, item.code));
  const filteredToppings = toppings.filter((item) => matches(item));
  const count = tab === 'products' ? filteredProducts.length : filteredToppings.length;
  const columns =
    tab === 'products'
      ? ['Tên sản phẩm', 'Mã sản phẩm', 'Số lượng', 'Trạng thái', 'Bật bán', 'Thao tác']
      : ['Tên topping', 'Trạng thái', 'Bật bán'];
  return (
    <section
      id="inventory-panel"
      role="tabpanel"
      aria-labelledby={`inventory-tab-${tab}`}
      className={styles.panel}
    >
      <div
        className={styles.tableScroll}
        role="region"
        aria-label={tab === 'products' ? 'Tồn kho sản phẩm' : 'Danh sách topping'}
        tabIndex={0}
        aria-busy={loading}
      >
        <table
          className={`${styles.table} ${tab === 'products' ? styles.products : styles.toppings}`}
        >
          <caption className={styles.srOnly}>
            {tab === 'products' ? 'Tồn kho và trạng thái bán sản phẩm' : 'Trạng thái bán topping'}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className={styles.tableMessage} colSpan={columns.length} role="status">
                  Đang tải dữ liệu…
                </td>
              </tr>
            ) : count === 0 ? (
              <tr>
                <td className={styles.tableMessage} colSpan={columns.length}>
                  {failed
                    ? 'Chưa thể tải dữ liệu. Vui lòng làm mới để thử lại.'
                    : search || status !== 'all'
                      ? 'Không tìm thấy kết quả phù hợp.'
                      : tab === 'products'
                        ? 'Chưa có sản phẩm.'
                        : 'Chưa có topping.'}
                </td>
              </tr>
            ) : tab === 'products' ? (
              filteredProducts.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.name.vi || item.name.en}</th>
                  <td className={styles.code} title={item.code || 'API chưa cung cấp mã sản phẩm'}>
                    {item.code || '—'}
                  </td>
                  <td className={item.stockQty === 0 ? styles.zero : styles.quantity}>
                    {item.stockQty === null ? (
                      <span className={styles.untracked}>Không theo dõi số lượng</span>
                    ) : (
                      item.stockQty.toLocaleString('vi-VN')
                    )}
                  </td>
                  <td>
                    <InventoryStatus available={item.isAvailable} quantity={item.stockQty} />
                  </td>
                  <td>
                    <AvailabilityToggle item={item} disabled={busy} onChange={onAvailability} />
                  </td>
                  <td>
                    <button
                      className={`${styles.button} ${styles.editButton}`}
                      disabled={busy}
                      aria-label={`Chỉnh số lượng ${item.name.vi || item.name.en}`}
                      onClick={() => onEdit(item)}
                    >
                      Chỉnh số lượng
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              filteredToppings.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.name.vi || item.name.en}</th>
                  <td>
                    <InventoryStatus available={item.isAvailable} />
                  </td>
                  <td>
                    <AvailabilityToggle item={item} disabled={busy} onChange={onAvailability} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
