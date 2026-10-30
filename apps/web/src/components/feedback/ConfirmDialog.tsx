'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/vellum/Button';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';

/**
 * The shared destructive-action confirmation. It deliberately uses the same
 * modal shell as the admin forms so keyboard and focus behaviour stay identical.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
      footer={
        <>
          <Button variant="quiet" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger-fill' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {children}
    </Modal>
  );
}
