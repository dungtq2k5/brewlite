import { loadInventory } from '@/lib/staff/api';
import { InventoryWorkspace } from '@/components/staff/inventory/InventoryWorkspace';
export default async function StaffStocksPage() {
  return <InventoryWorkspace initial={await loadInventory()} />;
}
