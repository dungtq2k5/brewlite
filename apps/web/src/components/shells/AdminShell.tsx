import Link from 'next/link';
import AdminNav from '@/components/AdminNav';
import LogoutButton from '@/components/LogoutButton';
import type { SessionUser } from '@/lib/session';

export default function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-rail">
        <div className="admin-brand">
          <Link className="wordmark" href="/admin">
            BrewLite
          </Link>
          <span>Quản trị</span>
        </div>
        <AdminNav />
        <div className="rail-foot">
          <p className="rail-user">{user.fullName}</p>
          <p className="rail-email">{user.email}</p>
          <Link className="rail-link" href="/">
            <span className="rail-num">↩</span>
            <span>Về cửa hàng</span>
          </Link>
          <LogoutButton label="Đăng xuất" className="rail-link" />
          <p className="rail-note">Dữ liệu vận hành hiển thị trực tiếp từ hệ thống.</p>
        </div>
      </aside>
      <main className="admin-main" id="main">
        <div className="admin-inner">{children}</div>
      </main>
    </div>
  );
}
