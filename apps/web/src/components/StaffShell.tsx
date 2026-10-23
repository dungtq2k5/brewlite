import { LayoutGrid, Package, Store } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { MeResponseDto } from '@brewlite/api-client';
import { getT } from '@/i18n/server';
import { AccountMenu } from './AccountMenu';
import { LanguageSwitch } from './LanguageSwitch';
import { NavLink } from './NavLink';

const rail =
  'flex min-h-14 w-20 flex-col items-center justify-center gap-1 rounded-box text-xs font-semibold';

/** The tablet frame (15:572): a dark rail, a title bar, the page. Empty until the board is built. */
export async function StaffShell({
  me,
  children,
}: Readonly<{ me: MeResponseDto; children: ReactNode }>) {
  const { t } = await getT('common');
  return (
    <div className="flex min-h-dvh">
      <nav
        aria-label={t('staff.nav.label')}
        className="bg-neutral text-neutral-content flex w-24 flex-col items-center gap-2 py-4"
      >
        <Image src="/symbol.svg" alt="" width={36} height={36} unoptimized className="mb-4" />
        <NavLink
          href="/staff"
          exact
          className={rail}
          activeClass="bg-secondary text-secondary-content"
        >
          <LayoutGrid aria-hidden size={22} />
          {t('staff.nav.board')}
        </NavLink>
        <NavLink
          href="/staff/products"
          className={rail}
          activeClass="bg-secondary text-secondary-content"
        >
          <Package aria-hidden size={22} />
          {t('staff.nav.stock')}
        </NavLink>
        <NavLink href="/" exact className={`${rail} mt-auto`} activeClass="">
          <Store aria-hidden size={22} />
          {t('staff.nav.shop')}
        </NavLink>
      </nav>
      <div className="bg-base-200 flex min-w-0 flex-1 flex-col">
        <header className="bg-base-100 border-base-300 flex items-center gap-3 border-b px-6 py-3">
          <h1 className="text-2xl font-semibold">{t('staff.title')}</h1>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitch />
            <AccountMenu
              user={{ fullName: me.fullName, email: me.email, permissions: me.permissions }}
            />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
