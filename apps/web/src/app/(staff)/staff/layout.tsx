'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StaffIcon } from '@/components/staff/StaffIcon';
import LogoutButton from '@/components/staff/LogoutButton';
import styles from './staff.module.css';

const navigation = [
  { href: '/staff', label: 'Đơn đang xử lý', icon: 'receipt' as const },
  { href: '/staff/stocks', label: 'Tồn kho', icon: 'box' as const },
  { href: '/staff/account', label: 'Tài khoản', icon: 'user' as const },
];

function StaffNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={mobile ? styles.mobileNav : styles.navigation}
      aria-label="Điều hướng nhân viên"
    >
      {navigation.map((item) => (
        <Link
          className={styles.navItem}
          href={item.href}
          key={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
        >
          <StaffIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.backdrop}
      style={{
        height: '100dvh',
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        className={styles.shell}
        style={{
          height: '100%',
          minHeight: 0,
          maxHeight: '100%',
          overflow: 'hidden',
        }}
      >
        <aside
          className={styles.sidebar}
          style={{
            height: '100%',
            minHeight: 0,
            maxHeight: '100%',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Tên và logo quán */}
          <Link href="/staff" className={styles.brand}>
            <div className="w-9 h-9 rounded-full bg-[#4E3427] flex items-center justify-center text-white shadow-xs">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
              </svg>
            </div>
            <strong>BrewLite</strong>
          </Link>

          <StaffNavigation />

          <div className={styles.sidebarSpacer} />

          <div className={styles.sidebarFooter}>
            <div className={styles.profile}>
              <span className={styles.avatar}>MA</span>
              <span className={styles.profileText}>
                <strong>Nguyễn Minh Anh</strong>
                <small>Nhân viên</small>
              </span>
            </div>

            <LogoutButton />
          </div>
        </aside>

        <div
          className={styles.main}
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <header className={styles.topbar} style={{ flexShrink: 0 }}>
            <Link href="/staff" className={styles.mobileBrand}>
              <span className={styles.brandMark}>
                <StaffIcon name="cup" />
              </span>
              <strong>BrewLite</strong>
            </Link>

            <div className={styles.topbarRight}>
              <span className={styles.liveStatus}>
                <i />
                Đang cập nhật trực tiếp
              </span>

              <div className={styles.language} aria-label="Ngôn ngữ hiện tại: Tiếng Việt">
                <span className={styles.languageActive}>VI</span>
                <span>EN</span>
              </div>

              <span className={styles.topAvatar}>MA</span>
            </div>
          </header>

          <main
            className={styles.content}
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              minWidth: 0,
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </main>
        </div>

        <StaffNavigation mobile />
      </div>
    </div>
  );
}
