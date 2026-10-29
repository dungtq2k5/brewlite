import type { Metadata } from 'next';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'Không đủ quyền — BrewLite',
  robots: { index: false },
};

export default function ForbiddenPage() {
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
          <h1>Không đủ quyền</h1>
          <p className="page-meta">
            Tài khoản đang đăng nhập không có quyền mở trang này. Quyền được kiểm tra ở máy chủ; đổi
            tài khoản nếu bạn cần truy cập khu vực khác.
          </p>

          <div className="notice notice--warning" style={{ marginTop: 'var(--space-md)' }}>
            Nếu bạn cho rằng đây là nhầm lẫn, hãy đăng xuất rồi đăng nhập lại bằng tài khoản được
            cấp quyền.
          </div>

          <div style={{ marginTop: 'var(--space-md)', display: 'grid', gap: 'var(--space-sm)' }}>
            <Link className="btn btn--primary btn--block" href="/">
              Về trang chủ
            </Link>
            <LogoutButton className="btn btn--block" />
          </div>
        </div>
      </section>
    </main>
  );
}
