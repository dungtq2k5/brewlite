'use client';
import { useRef, useState } from 'react';
import { inventoryApi, inventoryError } from './inventory-api';
import type {
  InventoryProduct,
  InventoryTab,
  InventoryTopping,
  Result,
} from '@/lib/staff/contracts';
export type InventoryData = {
  products: InventoryProduct[];
  toppings: InventoryTopping[];
};
export function useInventory(tab: InventoryTab, initial: Result<InventoryData>) {
  const [data, setData] = useState(initial.ok ? initial.data : { products: [], toppings: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial.ok ? '' : initial.error);
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(!initial.ok);
  const ready = useRef(initial.ok);
  const locked = useRef(false);
  async function refresh() {
    if (locked.current) return;
    locked.current = true;
    ready.current = false;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      setData(await inventoryApi.load());
      ready.current = true;
      setNeedsRefresh(false);
    } catch (cause) {
      setNeedsRefresh(true);
      setError(inventoryError(cause));
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  async function reconcile(cause: unknown): Promise<Error> {
    const code = inventoryError(cause);
    setError(code);
    try {
      setData(await inventoryApi.load());
      setNotice('Đã tải lại dữ liệu hiện tại; vui lòng kiểm tra trước khi lưu lại.');
    } catch {
      ready.current = false;
      setNeedsRefresh(true);
      setNotice(
        'Chưa thể xác minh dữ liệu đã lưu. Đóng hộp thoại và nhấn Làm mới trước khi tiếp tục.',
      );
    }
    return new Error(code);
  }
  async function setAvailability(id: string, isAvailable: boolean) {
    if (locked.current || !ready.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const product = data.products.find((item) => item.id === id);
      await inventoryApi.availability(
        tab,
        id,
        tab === 'products' && product?.stockQty === 0 ? false : isAvailable,
      );
      setData(await inventoryApi.load());
      setNotice('Đã cập nhật trạng thái bán.');
    } catch (cause) {
      await reconcile(cause);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function setQuantity(
    product: InventoryProduct,
    stockQty: number | null,
    available: boolean,
  ) {
    if (locked.current || !ready.current) throw new Error('requestFailed');
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await inventoryApi.saveQuantity(product, stockQty, available);
      setData((current) => ({
        ...current,
        products: current.products.map((item) => (item.id === updated.id ? updated : item)),
      }));
      setNotice('Đã cập nhật số lượng.');
    } catch (cause) {
      throw await reconcile(cause);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    ...data,
    loading,
    busy,
    mutationBlocked: busy || loading || needsRefresh,
    error,
    notice,
    refresh,
    setAvailability,
    setQuantity,
  };
}
