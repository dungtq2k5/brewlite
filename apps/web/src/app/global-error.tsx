'use client';

/**
 * Last-resort boundary: it replaces the root layout, so it owns <html> and <body> and
 * cannot rely on the design tokens or providers. Keep it self-contained and readable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f3efe6',
          color: '#1f1a13',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <main
          style={{
            width: '100%',
            maxWidth: 520,
            padding: 24,
            border: '1px solid #1f1a13',
            borderRadius: 12,
            background: '#fbf8f1',
          }}
        >
          <p
            style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            BrewLite
          </p>
          <h1 style={{ margin: '12px 0 8px', fontSize: 26 }}>
            Đã xảy ra lỗi / Something went wrong
          </h1>
          <p style={{ margin: '0 0 16px', lineHeight: 1.5, color: '#5b5145' }}>
            Trang không tải được. Vui lòng thử lại. / The page could not load. Please try again.
          </p>
          {error.digest && (
            <p style={{ margin: '0 0 16px', fontSize: 12, wordBreak: 'break-all' }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '10px 16px',
                border: '1px solid #1f1a13',
                borderRadius: 8,
                background: '#1f1a13',
                color: '#fbf8f1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Thử lại / Try again
            </button>
            <a
              href="/"
              style={{
                padding: '10px 16px',
                border: '1px solid #1f1a13',
                borderRadius: 8,
                color: '#1f1a13',
                textDecoration: 'none',
              }}
            >
              Về trang chủ / Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
