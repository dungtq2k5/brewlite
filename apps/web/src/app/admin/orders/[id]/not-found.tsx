import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { getT } from '@/i18n/server';

/** A missing or mistyped order (`105:6916`). */
export default async function AdminOrderNotFound() {
  const { t } = await getT('admin');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="bg-base-200 grid size-24 place-items-center rounded-full">
        <SearchX aria-hidden size={40} />
      </span>
      <h1 className="text-2xl font-bold">{t('orders.notFound')}</h1>
      <p>{t('orders.notFoundHint')}</p>
      <Link href="/admin/orders" className="btn btn-primary">
        {t('orders.toList')}
      </Link>
    </div>
  );
}
