import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import StaffNav from '@/components/StaffNav';
import type { SessionUser } from '@/lib/session';

export default function StaffShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="console-bar">
        <div className="console-bar-inner">
          <div className="console-brand">
            <Link className="wordmark wordmark--console" href="/staff">
              BrewLite
            </Link>
            <span className="console-role">Quầy</span>
          </div>
          <StaffNav />
          <div className="console-user">
            <span>{user.fullName}</span>
            <LogoutButton
              label="Đăng xuất"
              className="text-link"
              style={{ color: 'var(--color-shell-ink)' }}
            />
          </div>
        </div>
      </header>
      <main className="console-main" id="main">
        {children}
      </main>
    </>
  );
}
