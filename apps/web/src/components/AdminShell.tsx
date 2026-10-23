import { Home, LayoutGrid, Package, Receipt, Tag, Users } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { MeResponseDto } from '@brewlite/api-client';
import { getT } from '@/i18n/server';
import { AccountMenu } from './AccountMenu';
import { LanguageSwitch } from './LanguageSwitch';
import { NavLink } from './NavLink';

const link = 'flex min-h-11 items-center gap-3 rounded-field px-3 text-sm font-medium';
const active = 'bg-primary text-primary-content';

/** The desktop frame (15:658): a sidebar by area, a title bar, the page. Empty until the admin pages exist. */
export async function AdminShell({
  me,
  children,
}: Readonly<{ me: MeResponseDto; children: ReactNode }>) {
  const { t } = await getT('common');
  const groups = [
    {
      key: 'menu',
      items: [
        { href: '/admin/categories', icon: LayoutGrid, label: 'categories' },
        { href: '/admin/products', icon: Package, label: 'products' },
        { href: '/admin/toppings', icon: Tag, label: 'toppings' },
      ],
    },
    {
      key: 'sales',
      items: [
        { href: '/admin/promotions', icon: Tag, label: 'promotions' },
        { href: '/admin/orders', icon: Receipt, label: 'orders' },
      ],
    },
    { key: 'people', items: [{ href: '/admin/users', icon: Users, label: 'users' }] },
    {
      key: 'counter',
      items: [
        { href: '/staff', icon: LayoutGrid, label: 'staffBoard' },
        { href: '/staff/products', icon: Package, label: 'stock' },
      ],
    },
  ] as const;

  return (
    <div className="flex min-h-dvh">
      <nav
        aria-label={t('admin.nav.label')}
        className="bg-base-200 border-base-300 flex w-60 flex-col gap-4 border-r p-3"
      >
        <div className="flex items-center gap-2 px-2 py-2">
          <Image src="/logo.svg" alt={t('brand')} width={110} height={25} unoptimized />
          <span className="bg-neutral text-neutral-content rounded px-1.5 py-0.5 text-xs font-bold">
            {t('admin.badge')}
          </span>
        </div>
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-bold tracking-wide uppercase">
              {t(`admin.nav.${group.key}`)}
            </p>
            {group.items.map(({ href, icon: Icon, label }) => (
              <NavLink key={href} href={href} className={link} activeClass={active}>
                <Icon aria-hidden size={18} />
                {t(`admin.nav.${label}`)}
              </NavLink>
            ))}
          </div>
        ))}
        <NavLink href="/" exact className={`${link} mt-auto`} activeClass="">
          <Home aria-hidden size={18} />
          {t('admin.nav.backToShop')}
        </NavLink>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-base-300 flex items-center gap-3 border-b px-6 py-3">
          <h1 className="text-2xl font-semibold">{t('admin.pageTitle')}</h1>
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
