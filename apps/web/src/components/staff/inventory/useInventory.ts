'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { inventoryApi, InventoryApiError, inventoryError } from './inventory-api';
import type { InventoryProduct, InventoryTab, InventoryTopping } from './inventory-api';

export function useInventory(tab: InventoryTab) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [toppings, setToppings] = useState<InventoryTopping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (tab === 'products') {
        const data = await inventoryApi.products();
        if (current === generation.current) setProducts(data);
      } else {
        const data = await inventoryApi.toppings();
        if (current === generation.current) setToppings(data);
      }
    } catch (cause) {
      if (current === generation.current)
        setError(
          tab === 'toppings' && cause instanceof InventoryApiError && cause.status === 403
            ? 'Bạn chưa có quyền xem toàn bộ danh sách topping. Vui lòng liên hệ quản lý.'
            : inventoryError(cause),
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  async function setAvailability(id: string, isAvailable: boolean) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await inventoryApi.availability(tab, id, isAvailable);
      if (tab === 'products')
        setProducts((items) =>
          items.map((item) => (item.id === id ? { ...item, ...updated } : item)),
        );
      else setToppings((items) => items.map((item) => (item.id === id ? updated : item)));
      setNotice('Đã cập nhật trạng thái bán.');
    } catch (cause) {
      setError(inventoryError(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function setQuantity(product: InventoryProduct, stockQty: number | null) {
    if (locked.current) throw new Error('Vui lòng chờ thao tác hiện tại hoàn tất.');
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await inventoryApi.quantity(product, stockQty);
      setProducts((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setNotice('Đã cập nhật số lượng.');
    } catch (cause) {
      if (cause instanceof InventoryApiError && cause.code === 'STOCK_VERSION_CONFLICT')
        await refresh();
      throw cause;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    products,
    toppings,
    loading,
    busy,
    error,
    notice,
    refresh,
    setAvailability,
    setQuantity,
  };
}
