'use client';

import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The stock list could not be loaded (frame 86:8020). */
export default function StockError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('staff');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="bg-base-100 grid h-24 w-24 place-items-center rounded-full">
        <CloudOff aria-hidden size={40} />
      </span>
      <h2 className="text-2xl font-bold">{t('stock.failed.title')}</h2>
      <p>{t('stock.failed.body')}</p>
      <button type="button" className="btn btn-primary h-14 w-full" onClick={reset}>
        {t('stock.failed.retry')}
      </button>
    </div>
  );
}
