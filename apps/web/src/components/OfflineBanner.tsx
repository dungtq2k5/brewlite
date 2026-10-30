'use client';

import { useEffect, useRef, useState } from 'react';

export default function OfflineBanner({ locale }: { locale: 'vi' | 'en' }) {
  const isVi = locale === 'vi';
  const [isOnline, setIsOnline] = useState(true);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // The overlay is a modal surface: keep keyboard focus on its only action instead of
  // letting Tab wander through the page hidden behind it.
  useEffect(() => {
    if (!isOnline) retryRef.current?.focus();
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        retryRef.current?.focus();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-toast)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-lg)',
        background: 'var(--color-paper)',
      }}
    >
      <div className="panel" style={{ width: '100%', maxWidth: 460, padding: 'var(--space-lg)' }}>
        <p className="wordmark" style={{ fontSize: 'var(--text-xl)' }}>
          BrewLite
        </p>
        <h2
          id="offline-title"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-lg)',
            marginTop: 'var(--space-md)',
          }}
        >
          {isVi ? 'Bạn đang ngoại tuyến' : 'You are offline'}
        </h2>
        <p className="muted" style={{ marginTop: 'var(--space-2xs)' }}>
          {isVi
            ? 'Giỏ hàng vẫn được lưu trên thiết bị này. Kiểm tra kết nối mạng rồi thử lại.'
            : 'Your cart is saved on this device. Check your connection and try again.'}
        </p>
        <button
          className="btn btn--primary"
          type="button"
          ref={retryRef}
          style={{ marginTop: 'var(--space-md)' }}
          onClick={() => window.location.reload()}
        >
          {isVi ? 'Thử lại' : 'Try again'}
        </button>
      </div>
    </div>
  );
}
