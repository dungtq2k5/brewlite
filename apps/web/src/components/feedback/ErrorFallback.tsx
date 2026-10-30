'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/vellum/Button';
import { LOCALE_COOKIE, normalizeLocale, type Locale } from '@/i18n/locale';

function readLocale(): Locale {
  if (typeof document === 'undefined') return 'vi';
  const prefix = `${LOCALE_COOKIE}=`;
  const row = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return normalizeLocale(row?.slice(prefix.length));
}

/**
 * The one recovery card for render errors. It keeps the app shell and the brand,
 * explains what happened in the visitor's language, and offers a retry that re-renders
 * the failed segment instead of forcing a full reload.
 */
export function ErrorFallback({
  error,
  reset,
  homeHref = '/',
  homeLabel,
  scope = 'customer',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
  scope?: 'customer' | 'console';
}) {
  const [locale, setLocale] = useState<Locale>('vi');

  useEffect(() => {
    setLocale(readLocale());
  }, []);

  const isVi = locale === 'vi';
  const title = isVi ? 'Đã xảy ra lỗi' : 'Something went wrong';
  const body =
    scope === 'console'
      ? isVi
        ? 'Trang này không tải được. Dữ liệu bên dưới vẫn an toàn; thử lại trước khi tiếp tục thao tác.'
        : 'This page could not load. Your data is safe; retry before continuing.'
      : isVi
        ? 'Trang này không tải được. Giỏ hàng và đơn hàng của bạn vẫn được giữ nguyên.'
        : 'This page could not load. Your cart and orders are still safe.';

  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: scope === 'console' ? '60vh' : '70vh',
        padding: 'var(--space-lg)',
      }}
    >
      <section className="panel" style={{ width: '100%', maxWidth: 520 }}>
        <div className="panel-body stack" role="alert">
          <p className="page-meta">BrewLite</p>
          <h1 className="page-title" style={{ fontSize: 'var(--text-page-sm)' }}>
            {title}
          </h1>
          <p className="muted">{body}</p>
          {error.digest && (
            <p className="fine" style={{ overflowWrap: 'anywhere' }}>
              {isVi ? 'Mã lỗi' : 'Error ID'}: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            <Button variant="primary" onClick={reset}>
              {isVi ? 'Thử lại' : 'Try again'}
            </Button>
            <Link className="btn btn--quiet" href={homeHref}>
              {homeLabel ?? (isVi ? 'Về trang chủ' : 'Go home')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
