import { Coffee } from 'lucide-react';
import Link from 'next/link';
import { BackToMenu } from '@/components/product/BackToMenu';
import { getT } from '@/i18n/server';

/** `notFound()` from the product page — a missing and a malformed id both land here (frame 53:3750). */
export default async function ProductNotFound() {
  const { t } = await getT('menu');
  return (
    <div>
      <BackToMenu label={t('product.back')} />
      <div className="mx-auto mt-5 flex max-w-md flex-col items-center gap-4 px-4 pt-24 text-center">
        <span className="bg-secondary text-primary grid size-24 place-items-center rounded-full">
          <Coffee aria-hidden size={40} strokeWidth={1.5} />
        </span>
        <h1 className="text-[26px] leading-[34px] font-bold">{t('product.notFound.title')}</h1>
        <p className="text-base-content/75">{t('product.notFound.body')}</p>
        <Link href="/" className="btn btn-primary w-full text-base">
          {t('product.notFound.action')}
        </Link>
      </div>
    </div>
  );
}
