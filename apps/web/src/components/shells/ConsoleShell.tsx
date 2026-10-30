'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import LogoutButton from '@/components/LogoutButton';
import { ConsoleLocaleProvider } from '@/i18n/console-context';
import { consoleCopy } from '@/i18n/console';
import type { Locale } from '@/i18n/locale';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ConsoleNavItem {
  href: string;
  label: string;
  num?: string;
}

/**
 * Shared shell for the admin and staff surfaces: a persistent rail on desktop and the
 * same rail as an off-canvas drawer on small screens. It also owns the console locale
 * so every client page below can translate itself.
 */
export default function ConsoleShell({
  variant,
  locale,
  roleLabel,
  user,
  nav,
  note,
  children,
}: {
  variant: 'admin' | 'staff';
  locale: Locale;
  roleLabel: string;
  user: { fullName: string; email: string };
  nav: ConsoleNavItem[];
  note?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = consoleCopy(locale);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const railId = useId();
  const menuRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const rail = railRef.current;
    rail?.querySelector<HTMLElement>('.rail-nav a')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        menuRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !rail) return;

      const nodes = Array.from(rail.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !rail.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !rail.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const isActive = (href: string) => {
    const base = variant === 'admin' ? '/admin' : '/staff';
    if (href === base) return pathname === base;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <ConsoleLocaleProvider locale={locale}>
      <div className={drawerOpen ? 'admin-shell is-drawer-open' : 'admin-shell'}>
        <a className="skip-link" href="#main">
          {t('Bỏ qua điều hướng', 'Skip navigation')}
        </a>

        <header className="console-mobilebar">
          <button
            ref={menuRef}
            type="button"
            className="console-menu-button"
            aria-expanded={drawerOpen}
            aria-controls={railId}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
            {t('Menu', 'Menu')}
          </button>
          <Link className="wordmark wordmark--console" href={`/${variant}`}>
            BrewLite
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>

        <aside
          className="admin-rail"
          id={railId}
          ref={railRef}
          aria-label={t('Thanh bên', 'Sidebar')}
          role={drawerOpen ? 'dialog' : undefined}
          aria-modal={drawerOpen || undefined}
        >
          <div className="admin-brand">
            <Link className="wordmark" href={`/${variant}`}>
              BrewLite
            </Link>
            <span>{roleLabel}</span>
            <button
              type="button"
              className="console-rail-close"
              aria-label={t('Đóng menu', 'Close menu')}
              onClick={() => {
                setDrawerOpen(false);
                menuRef.current?.focus();
              }}
            >
              ×
            </button>
          </div>

          <nav
            className="rail-nav"
            aria-label={
              variant === 'admin'
                ? t('Điều hướng quản trị', 'Admin navigation')
                : t('Điều hướng quầy', 'Staff navigation')
            }
          >
            {nav.map((item, index) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? 'rail-link is-active' : 'rail-link'}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="rail-num">{item.num ?? String(index + 1).padStart(2, '0')}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="rail-foot">
            <p className="rail-user">{user.fullName}</p>
            <p className="rail-email">{user.email}</p>
            <Link className="rail-link" href="/">
              <span className="rail-num">↩</span>
              <span>{t('Về cửa hàng', 'Back to store')}</span>
            </Link>
            <LogoutButton
              label={t('Đăng xuất', 'Sign out')}
              pendingLabel={t('Đang đăng xuất…', 'Signing out…')}
              className="rail-link rail-logout"
              style={{ textAlign: 'left' }}
            />
            <div className="rail-locale">
              <span className="rail-locale-label">{t('Ngôn ngữ', 'Language')}</span>
              <LocaleSwitcher locale={locale} />
            </div>
            {note && <p className="rail-note">{note}</p>}
          </div>
        </aside>

        {drawerOpen && (
          <button
            type="button"
            className="console-scrim"
            aria-label={t('Đóng menu', 'Close menu')}
            onClick={() => {
              setDrawerOpen(false);
              menuRef.current?.focus();
            }}
          />
        )}

        <main className="admin-main" id="main">
          <div className="admin-inner">{children}</div>
        </main>
      </div>
    </ConsoleLocaleProvider>
  );
}
