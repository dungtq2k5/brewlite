'use client';
import { useState } from 'react';
import { StaffIcon } from '@/components/staff/StaffIcon';
import { InventoryToolbar } from '@/components/staff/inventory/InventoryToolbar';
import { InventoryTable } from '@/components/staff/inventory/InventoryTable';
import { QuantityDialog } from '@/components/staff/inventory/QuantityDialog';
import { useInventory } from '@/components/staff/inventory/useInventory';
import type { InventoryTab, StatusFilter } from '@/components/staff/inventory/inventory-api';
import { useStaffI18n } from '../i18n';
import type { Result } from '@/lib/staff/contracts';
import type { InventoryData } from './useInventory';
export function InventoryWorkspace({ initial }: { initial: Result<InventoryData> }) {
  const { t } = useStaffI18n();
  const [tab, setTab] = useState<InventoryTab>('products');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const inventory = useInventory(tab, initial);
  const editing = inventory.products.find((product) => product.id === editingId);
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 font-[Arial,Helvetica,sans-serif] text-[#68432f] max-[650px]:gap-3 [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-55 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-[3px] [&_button:focus-visible]:outline-[#825c3d]">
      <header className="flex shrink-0 items-center justify-between gap-4 [&_h1]:m-0 [&_h1]:text-[25px] [&_h1]:font-medium [&_h1]:tracking-[-0.6px] max-[650px]:[&_h1]:text-[23px]">
        <h1>{t('Tồn kho')}</h1>
        <button
          className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-[#ead2b3] bg-[#fffcf7] px-[17px] py-2 text-xs font-semibold text-[#68432f] enabled:hover:bg-[#f2e5d3] [&_svg]:size-[14px]"
          disabled={inventory.loading || inventory.busy}
          onClick={() => void inventory.refresh()}
        >
          <StaffIcon name="refresh" /> {t(inventory.loading ? 'Đang tải…' : 'Làm mới')}
        </button>
      </header>
      <InventoryToolbar
        busy={inventory.busy || inventory.loading}
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
        <div
          className="m-0 shrink-0 rounded-lg border border-[#e8c7bd] bg-[#fff0eb] px-3 py-[10px] text-xs text-[#a13d2b]"
          role="alert"
        >
          {t(inventory.error)}
        </div>
      )}
      {inventory.notice && (
        <p className="m-0 shrink-0 text-xs text-[#365e40]" role="status">
          {t(inventory.notice)}
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
        busy={inventory.mutationBlocked}
        onAvailability={inventory.setAvailability}
        onEdit={(product) => setEditingId(product.id)}
      />
      {editing && (
        <QuantityDialog
          key={editing.id}
          product={editing}
          disabled={inventory.mutationBlocked}
          onClose={() => setEditingId(null)}
          onSave={inventory.setQuantity}
        />
      )}
    </div>
  );
}
