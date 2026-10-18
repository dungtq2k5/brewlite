import {
  refreshInventory,
  setInventoryAvailability,
  saveInventoryQuantity,
} from '@/lib/staff/actions';
import type { InventoryProduct, InventoryTab, Result } from '@/lib/staff/contracts';
export type {
  InventoryProduct,
  InventoryTopping,
  InventoryTab,
  StatusFilter,
} from '@/lib/staff/contracts';
export function isProductAvailable(product: InventoryProduct): boolean {
  return product.stockQty !== 0 && product.isAvailable;
}
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
export const inventoryApi = {
  async load() {
    return unwrap(await refreshInventory());
  },
  async availability(tab: InventoryTab, id: string, isAvailable: boolean) {
    return unwrap(await setInventoryAvailability(tab, id, isAvailable));
  },
  async saveQuantity(product: InventoryProduct, stockQty: number | null, available: boolean) {
    return unwrap(
      await saveInventoryQuantity(
        product.id,
        { stockQty, expectedVersion: product.version },
        available,
      ),
    );
  },
};
export function inventoryError(error: unknown): string {
  const codes = [
    'requestFailed',
    'unauthenticated',
    'forbidden',
    'conflict',
    'invalidState',
    'notFound',
    'invalidInput',
  ];
  return error instanceof Error && codes.includes(error.message) ? error.message : 'requestFailed';
}
