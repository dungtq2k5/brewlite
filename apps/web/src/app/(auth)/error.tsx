'use client';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';

export default function AuthError({
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
      homeHref="/login"
      homeLabel="Về đăng nhập / Sign in"
    />
  );
}
