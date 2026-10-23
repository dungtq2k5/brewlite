'use client';

import { LogOut } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut } from '@/actions/auth';
import { clearCart, readCartCount } from './useCartCount';

/** Confirms only when the cart has something in it (D01 §12.1); then clears the cart and signs out. */
export function SignOutButton({ onCancel }: Readonly<{ onCancel?: () => void }>) {
  const { t } = useTranslation('common');
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      clearCart();
      await signOut();
    });

  const cancel = () => {
    setConfirming(false);
    onCancel?.();
  };

  const onClick = () => (readCartCount() > 0 ? setConfirming(true) : run());

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-error flex min-h-11 w-full items-center gap-3 px-4 text-left font-medium"
      >
        <LogOut aria-hidden size={20} />
        {t('account.signOut')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" aria-hidden onClick={cancel} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            className="bg-base-100 relative w-full rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-box"
          >
            <h2 id="signout-title" className="mb-2 text-xl font-semibold">
              {t('signOut.title')}
            </h2>
            <p className="mb-6">{t('signOut.body')}</p>
            <button type="button" className="btn btn-error w-full" onClick={run} disabled={pending}>
              {t('signOut.confirm')}
            </button>
            <button type="button" className="btn btn-ghost mt-2 w-full" onClick={cancel} autoFocus>
              {t('signOut.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
