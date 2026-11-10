'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A confirmation (`95:1111`): the **safe choice first**, focus trapped (a native modal `<dialog>`),
 * `Esc` cancels. `children` is for extra fields (a lock's reason and date). The confirm button is
 * disabled while `pending`, and a refusal is shown as `error` inside the dialog.
 */
export function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  keepLabel,
  tone = 'error',
  pending = false,
  disabled = false,
  error,
  onConfirm,
  onClose,
  children,
}: Readonly<{
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  keepLabel?: string;
  tone?: 'error' | 'primary';
  pending?: boolean;
  disabled?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}>) {
  const { t } = useTranslation('admin');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="admin-confirm-title"
      onClose={onClose}
      className="bg-base-100 rounded-box m-auto w-full max-w-md p-0 backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id="admin-confirm-title" className="text-xl font-semibold">
          {title}
        </h2>
        {body && <div>{body}</div>}
        {children}
        {error && (
          <p role="alert" className="text-error text-sm font-medium">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className={`btn ${tone === 'error' ? 'btn-error' : 'btn-primary'} min-h-11`}
            disabled={pending || disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn-outline min-h-11"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            {keepLabel ?? t('confirm.keep')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
