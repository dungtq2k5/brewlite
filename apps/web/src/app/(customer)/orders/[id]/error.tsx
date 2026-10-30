'use client';

import { CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The order could not be read (frame 64:3823) — inside the customer layout, the header stays. */
export default function OrderError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('orders');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
        <CloudOff aria-hidden size={40} />
      </span>
      <h1 className="text-2xl font-bold">{t('order.failed.title')}</h1>
      <p>{t('order.failed.body')}</p>
      <button type="button" className="btn btn-primary w-full" onClick={reset}>
        {t('order.failed.retry')}
      </button>
    </div>
  );
}
