'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@/components/ErrorView';

export default function ErrorPage({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const { t } = useTranslation('common');
  return (
    <ErrorView
      title={t('error.title')}
      body={t('error.body')}
      retryLabel={t('error.retry')}
      onRetry={reset}
      home={
        <Link href="/" className="btn btn-ghost">
          {t('error.home')}
        </Link>
      }
      reference={error.digest ? t('error.reference', { id: error.digest }) : undefined}
    />
  );
}
