'use client';

import { LogOut } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut } from '@/actions/auth';
import { clearCart, itemsInStorage } from '@/lib/cart/storage';
import { ConfirmSheet } from './ConfirmSheet';

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

  const onClick = () => (itemsInStorage() > 0 ? setConfirming(true) : run());

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
        <ConfirmSheet
          title={t('signOut.title')}
          body={t('signOut.body')}
          confirmLabel={t('signOut.confirm')}
          keepLabel={t('signOut.cancel')}
          pending={pending}
          onConfirm={run}
          onClose={cancel}
        />
      )}
    </>
  );
}
