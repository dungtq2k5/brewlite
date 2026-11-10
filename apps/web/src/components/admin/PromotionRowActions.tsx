'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { restorePromotion } from '@/actions/admin/promotions';
import { useAdminError } from './useAdminError';

/** *Edit* for a live promotion, *Restore* in the *Deleted* view. Deleting is on the edit page. */
export function PromotionRowActions({ id, deleted }: Readonly<{ id: string; deleted: boolean }>) {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const message = useAdminError();
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const link = 'inline-flex min-h-11 items-center px-2 text-sm font-semibold underline';

  if (!deleted) {
    return (
      <Link href={`/admin/promotions/${id}`} className={link}>
        {t('action.edit')}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        className={link}
        onClick={() =>
          start(async () => {
            const res = await restorePromotion(id);
            if (res.ok) return router.refresh();
            setError(message(res.code, res.details));
          })
        }
      >
        {t('action.restore')}
      </button>
      {error && (
        <span role="alert" className="text-error block text-xs">
          {error}
        </span>
      )}
    </>
  );
}
