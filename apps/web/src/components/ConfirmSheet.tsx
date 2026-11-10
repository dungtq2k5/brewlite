'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * A confirmation — a bottom sheet on phones, a dialog on wider screens. A native `<dialog>` opened
 * with `showModal()`: the browser traps focus, makes the page behind inert and closes it on `Esc`.
 * A click on the backdrop closes it too. Focus starts on the safe choice (*keep*), moved there by
 * code once the dialog opens.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  keepLabel,
  pending = false,
  onConfirm,
  onClose,
}: Readonly<{
  title: string;
  body: string;
  confirmLabel: string;
  keepLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    keep.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      // A confirmation that interrupts: alertdialog, as the hand-built sheets were.
      role="alertdialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose(); // the backdrop, not the content
      }}
      className="bg-base-100 m-auto w-full p-0 backdrop:bg-black/40 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-t-3xl sm:rounded-box sm:max-w-sm"
    >
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 id={titleId} className="mb-2 text-xl font-semibold">
          {title}
        </h2>
        <p className="mb-6">{body}</p>
        <button
          type="button"
          className="btn btn-error w-full"
          onClick={onConfirm}
          disabled={pending}
        >
          {confirmLabel}
        </button>
        <button ref={keep} type="button" className="btn btn-ghost mt-2 w-full" onClick={onClose}>
          {keepLabel}
        </button>
      </div>
    </dialog>
  );
}
