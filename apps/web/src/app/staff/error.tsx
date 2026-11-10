'use client';

import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The board could not be loaded (frame 84:3265). */
export default function BoardError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('staff');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="bg-base-100 grid h-24 w-24 place-items-center rounded-full">
        <CloudOff aria-hidden size={40} />
      </span>
      <h2 className="text-2xl font-bold">{t('failed.title')}</h2>
      <p>{t('failed.body')}</p>
      <button type="button" className="btn btn-primary h-14 w-full" onClick={reset}>
        {t('failed.retry')}
      </button>
    </div>
  );
}
