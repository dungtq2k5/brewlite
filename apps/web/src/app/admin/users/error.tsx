'use client';

import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The list could not be loaded (`97:2323`). */
export default function UsersError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('admin');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="bg-base-200 grid size-20 place-items-center rounded-full">
        <CloudOff aria-hidden size={36} />
      </span>
      <h1 className="text-2xl font-bold">{t('list.state.failedTitle')}</h1>
      <button type="button" className="btn btn-primary min-h-11" onClick={reset}>
        {t('list.state.retry')}
      </button>
    </div>
  );
}
