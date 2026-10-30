'use client';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      scope="console"
      homeHref="/admin"
      homeLabel="Về tổng quan / Overview"
    />
  );
}
