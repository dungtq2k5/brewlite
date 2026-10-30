'use client';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';

export default function StaffError({
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
      homeHref="/staff"
      homeLabel="Về bảng đơn / Order board"
    />
  );
}
