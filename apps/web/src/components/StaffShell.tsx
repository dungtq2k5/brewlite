import { LayoutGrid, Package, Store } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { MeResponseDto } from '@brewlite/api-client';
import { getT } from '@/i18n/server';
import { AccountMenu } from './AccountMenu';
import { LanguageSwitch } from './LanguageSwitch';
import { NavLink } from './NavLink';
import { LiveBadge } from './staff/LiveBadge';
import { SoundToggle } from './staff/SoundToggle';
import { StaffTitle } from './staff/StaffTitle';
import { ToastProvider } from './Toast';

// A 96 px dark rail on a tablet; on a phone (≤ 639 px) the same three links are a bottom bar.
const link =
  'rounded-box flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold sm:w-20 sm:flex-none';

/**
 * The tablet frame (15:572, 84:21): a dark rail, a title bar with the live state and the sound pill,
 * the page. Fixed to the viewport: the board's columns scroll on their own under sticky headers.
 */
export async function StaffShell({
  me,
  children,
}: Readonly<{ me: MeResponseDto; children: ReactNode }>) {
  const { t } = await getT('common');
  const board = me.permissions.includes('order.board.read');
  return (
    <ToastProvider>
      <div className="flex h-dvh flex-col sm:flex-row">
        <nav
          aria-label={t('staff.nav.label')}
          className="bg-neutral text-neutral-content order-last flex gap-1 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:order-first sm:w-24 sm:flex-col sm:items-center sm:gap-2 sm:px-0 sm:py-4"
        >
          <Image
            src="/symbol.svg"
            alt=""
            width={36}
            height={36}
            unoptimized
            className="mb-4 max-sm:hidden"
          />
          {board && (
            <NavLink
              href="/staff"
              exact
              className={link}
              activeClass="bg-secondary text-secondary-content"
            >
              <LayoutGrid aria-hidden size={22} />
              {t('staff.nav.board')}
            </NavLink>
          )}
          <NavLink
            href="/staff/products"
            className={link}
            activeClass="bg-secondary text-secondary-content"
          >
            <Package aria-hidden size={22} />
            {t('staff.nav.stock')}
          </NavLink>
          <NavLink href="/" exact className={`${link} sm:mt-auto`} activeClass="">
            <Store aria-hidden size={22} />
            {t('staff.nav.shop')}
          </NavLink>
        </nav>
        <div className="bg-base-200 flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="bg-base-100 border-base-300 flex items-center gap-3 border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-3">
            <StaffTitle />
            <div className="ml-auto flex items-center gap-3">
              <LiveBadge />
              {board && <SoundToggle />}
              <span className="max-sm:hidden">
                <LanguageSwitch />
              </span>
              <AccountMenu
                withLanguage
                user={{ fullName: me.fullName, email: me.email, permissions: me.permissions }}
              />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
