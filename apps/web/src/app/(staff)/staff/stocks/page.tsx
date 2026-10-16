'use client';

import { useState } from 'react';
import { StaffIcon } from '@/components/staff/StaffIcon';
import { InventoryToolbar } from '@/components/staff/inventory/InventoryToolbar';
import { InventoryTable } from '@/components/staff/inventory/InventoryTable';
import { QuantityDialog } from '@/components/staff/inventory/QuantityDialog';
import { useInventory } from '@/components/staff/inventory/useInventory';
import type {
  InventoryTab,
  StatusFilter,
  InventoryProduct,
} from '@/components/staff/inventory/inventory-api';
import styles from '@/components/staff/inventory/Inventory.module.css';

export default function StaffStocksPage() {
  const [tab, setTab] = useState<InventoryTab>('products');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const inventory = useInventory(tab);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Tồn kho</h1>
        <button
          className={styles.button}
          disabled={inventory.loading || inventory.busy}
          onClick={() => void inventory.refresh()}
        >
          <StaffIcon name="refresh" /> {inventory.loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </header>
      <InventoryToolbar
        busy={inventory.busy}
        tab={tab}
        onTabChange={(next) => {
          setTab(next);
          setSearch('');
        }}
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />
      {inventory.error && (
        <div className={styles.error} role="alert">
          {inventory.error}
        </div>
      )}
      {inventory.notice && (
        <p className={styles.notice} role="status">
          {inventory.notice}
        </p>
      )}
      <InventoryTable
        tab={tab}
        products={inventory.products}
        toppings={inventory.toppings}
        search={search}
        status={status}
        loading={inventory.loading}
        failed={Boolean(inventory.error)}
        busy={inventory.busy}
        onAvailability={inventory.setAvailability}
        onEdit={setEditing}
      />
      {editing && (
        <QuantityDialog
          product={editing}
          onClose={() => setEditing(null)}
          onSave={inventory.setQuantity}
        />
      )}
    </div>
  );
}
