import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getT } from '@/i18n/server';
import { getMe } from '@/lib/me';
import { safeNextPath } from '@/lib/safe-next-path';

export async function generateMetadata() {
  const { t } = await getT('auth');
  return { title: t('register.title') };
}

export default async function RegisterPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ next?: string | string[] }> }>) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  // Someone already signed in has no use for this page.
  if (await getMe()) redirect(next);
  const { t } = await getT('auth');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm">
        <ChevronLeft aria-hidden size={18} />
        {t('back')}
      </Link>
      <div>
        <h1 className="text-3xl font-bold">{t('register.title')}</h1>
        <p className="mt-1">{t('register.subtitle')}</p>
      </div>
      <AuthForm mode="register" next={next} />
    </div>
  );
}
