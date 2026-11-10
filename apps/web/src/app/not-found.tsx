import { Compass } from 'lucide-react';
import Link from 'next/link';
import { CustomerShell } from '@/components/CustomerShell';
import { getT } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getT('common');
  return (
    <CustomerShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
        <span className="bg-base-200 grid h-24 w-24 place-items-center rounded-full">
          <Compass aria-hidden size={40} />
        </span>
        <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
        <Link href="/" className="btn btn-primary w-full">
          {t('notFound.action')}
        </Link>
      </div>
    </CustomerShell>
  );
}
