'use client';

import { CloudOff } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

/** The product could not be loaded (frame 53:3801). */
export default function ProductError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('menu');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
        <CloudOff aria-hidden size={40} />
      </span>
      <h1 className="text-2xl font-bold">{t('product.failed.title')}</h1>
      <button type="button" className="btn btn-primary w-full" onClick={reset}>
        {t('product.failed.retry')}
      </button>
      <Link href="/" className="btn btn-ghost">
        {t('product.failed.action')}
      </Link>
    </div>
  );
}
