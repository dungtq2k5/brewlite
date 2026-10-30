import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { getT } from '@/i18n/server';

/** A missing, malformed or someone else's order — all the same page (frame 64:3770). */
export default async function OrderNotFound() {
  const { t } = await getT('orders');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
        <SearchX aria-hidden size={40} />
      </span>
      <h1 className="text-2xl font-bold">{t('order.notFound.title')}</h1>
      <p>{t('order.notFound.body')}</p>
      <Link href="/orders" className="btn btn-primary w-full">
        {t('order.notFound.orders')}
      </Link>
      <Link href="/" className="btn btn-ghost w-full">
        {t('order.notFound.menu')}
      </Link>
    </div>
  );
}
