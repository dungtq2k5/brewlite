export type InventoryTab = 'products' | 'toppings';
export type StatusFilter = 'all' | 'selling' | 'hidden';
export interface InventoryTopping {
  id: string;
  name: { vi: string; en: string };
  isAvailable: boolean;
}
export interface InventoryProduct extends InventoryTopping {
  stockQty: number | null;
  version: number;
  // The current staff API does not expose a product code.
  code?: string;
}
export class InventoryApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
  ) {
    super(
      status === 401
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : status === 403
          ? 'Bạn không có quyền thực hiện thao tác này.'
          : code === 'STOCK_VERSION_CONFLICT'
            ? 'Số lượng vừa thay đổi. Đóng cửa sổ và mở lại để nhập theo dữ liệu mới nhất.'
            : 'Không thể tải hoặc cập nhật dữ liệu. Vui lòng thử lại.',
    );
  }
}
async function request<T>(path: string, body?: object): Promise<T> {
  const token =
    localStorage.getItem('brewlite_access_token') ||
    localStorage.getItem('token') ||
    document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('bl_at='))
      ?.slice(6);
  const response = await fetch(`/api/v1${path}`, {
    method: body ? 'PATCH' : 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new InventoryApiError(response.status, json?.error?.code);
  if (!json) throw new Error('Phản hồi dữ liệu không hợp lệ. Vui lòng thử lại.');
  return json.data ?? json;
}
// List endpoints return complete arrays with server domain limits, not pages.
export const inventoryApi = {
  products: () => request<InventoryProduct[]>('/staff/products'),
  // No staff GET endpoint exists; the public menu cannot provide a complete list.
  toppings: () => request<InventoryTopping[]>('/admin/toppings?deleted=false'),
  availability: (tab: InventoryTab, id: string, isAvailable: boolean) =>
    request<InventoryProduct | InventoryTopping>(
      `/staff/${tab}/${encodeURIComponent(id)}/availability`,
      { isAvailable },
    ),
  quantity: (product: InventoryProduct, stockQty: number | null) =>
    request<InventoryProduct>(`/staff/products/${encodeURIComponent(product.id)}/stock`, {
      stockQty,
      expectedVersion: product.version,
    }),
};
export function inventoryError(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể kết nối. Vui lòng thử lại.';
}
