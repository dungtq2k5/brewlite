'use client';

import { CloudOff } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BackToMenu } from '@/components/product/BackToMenu';

/** The product could not be loaded (frame 53:3801). */
export default function ProductError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  const { t } = useTranslation('menu');
  return (
    <div>
      <BackToMenu label={t('product.back')} />
      <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-4 px-4 pt-24 text-center">
        <span className="bg-base-200 grid size-24 place-items-center rounded-full">
          <CloudOff aria-hidden size={40} />
        </span>
        <h1 className="text-[26px] leading-[34px] font-bold">{t('product.failed.title')}</h1>
        <p className="text-base-content/75">{t('product.failed.body')}</p>
        <button type="button" className="btn btn-primary w-full text-base" onClick={reset}>
          {t('product.failed.retry')}
        </button>
        <Link href="/" className="btn btn-ghost w-full text-base">
          {t('product.failed.action')}
        </Link>
      </div>
    </div>
  );
}
