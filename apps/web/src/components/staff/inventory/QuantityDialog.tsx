'use client';
import { useEffect, useRef, useState } from 'react';
import { inventoryError } from './inventory-api';
import type { InventoryProduct } from './inventory-api';
import styles from './Inventory.module.css';

export function QuantityDialog({
  product,
  onSave,
  onClose,
}: {
  product: InventoryProduct;
  onSave: (product: InventoryProduct, quantity: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState(product.stockQty?.toString() ?? '');
  const [untracked, setUntracked] = useState(product.stockQty === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="quantity-title"
      aria-describedby="quantity-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          const value = Number(quantity);
          if (
            !untracked &&
            (!quantity.trim() || !Number.isInteger(value) || value < 0 || value > 2147483647)
          ) {
            setError('Nhập số nguyên từ 0 đến 2.147.483.647.');
            return;
          }
          setSaving(true);
          setError('');
          try {
            await onSave(product, untracked ? null : value);
            onClose();
          } catch (cause) {
            setError(inventoryError(cause));
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2 id="quantity-title">Chỉnh số lượng</h2>
        <p id="quantity-description">{product.name.vi || product.name.en}</p>
        <fieldset disabled={saving}>
          <label className={styles.fieldLabel} htmlFor="stock-quantity">
            Số lượng tồn kho
          </label>
          <input
            autoFocus
            id="stock-quantity"
            className={styles.quantityInput}
            type="number"
            min="0"
            max="2147483647"
            step="1"
            required={!untracked}
            disabled={untracked}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'quantity-error' : undefined}
          />
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={untracked}
              onChange={(event) => setUntracked(event.target.checked)}
            />
            Không theo dõi số lượng
          </label>
        </fieldset>
        {error && (
          <p id="quantity-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.button} disabled={saving} onClick={onClose}>
            Hủy
          </button>
          <button className={`${styles.button} ${styles.primary}`} disabled={saving} type="submit">
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
