'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

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

  if (isOnline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
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
          Bạn đang ngoại tuyến
        </h2>
        <p className="muted" style={{ marginTop: 'var(--space-2xs)' }}>
          Giỏ hàng vẫn được lưu trên thiết bị này. Kiểm tra kết nối mạng rồi thử lại.
        </p>
        <button
          className="btn btn--primary"
          type="button"
          style={{ marginTop: 'var(--space-md)' }}
          onClick={() => window.location.reload()}
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
