import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { getT } from '@/i18n/server';

/** `notFound()` from the product page — a missing and a malformed id both land here (frame 53:3750). */
export default async function ProductNotFound() {
  const { t } = await getT('menu');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
        <SearchX aria-hidden size={40} />
      </span>
      <h1 className="text-2xl font-bold">{t('product.notFound.title')}</h1>
      <p>{t('product.notFound.body')}</p>
      <Link href="/" className="btn btn-primary w-full">
        {t('product.notFound.action')}
      </Link>
    </div>
  );
}
