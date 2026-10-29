import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div>
          <Link className="wordmark" href="/">
            BrewLite
          </Link>
          <p style={{ marginTop: 'var(--space-lg)' }}>
            Cà phê và trà pha theo từng ly. Đặt trước, nhận tại quầy.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h1>Bạn đang ngoại tuyến</h1>
          <p className="page-meta">
            Trang này cần kết nối mạng. Giỏ hàng vẫn được giữ trên thiết bị.
          </p>

          <div className="notice notice--warning" style={{ marginTop: 'var(--space-md)' }}>
            Kiểm tra Wi-Fi hoặc dữ liệu di động, sau đó thử lại. Đơn đã đặt vẫn giữ trạng thái trên
            máy chủ.
          </div>

          <Link
            className="btn btn--primary btn--block"
            href="/"
            style={{ marginTop: 'var(--space-md)' }}
          >
            Thử lại
          </Link>
        </div>
      </section>
    </main>
  );
}
