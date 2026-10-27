'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';
import { useLocale } from '@/i18n/locale-context';
import { BrandLogo } from '@/components/ui/brand-logo';

export interface AdminShellUser {
  id?: string;
  email?: string;
  fullName?: string;
  role?: 'CUSTOMER' | 'STAFF' | 'ADMIN' | string;
  preferredLocale?: 'vi' | 'en';
}

interface NavItem {
  href: string;
  labelVi: string;
  labelEn: string;
  shortVi: string;
  shortEn: string;
  icon: string;
  group: 'ADMIN' | 'STAFF';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', labelVi: 'Tổng quan', labelEn: 'Dashboard', shortVi: 'Tổng quan', shortEn: 'Home', icon: '☕', group: 'ADMIN' },
  { href: '/admin/users', labelVi: 'Người dùng', labelEn: 'Users', shortVi: 'Người dùng', shortEn: 'Users', icon: '👤', group: 'ADMIN' },
  { href: '/admin/categories', labelVi: 'Danh mục', labelEn: 'Categories', shortVi: 'Danh mục', shortEn: 'Categories', icon: '📂', group: 'ADMIN' },
  { href: '/admin/products', labelVi: 'Sản phẩm', labelEn: 'Products', shortVi: 'Thực đơn', shortEn: 'Menu', icon: '🧋', group: 'ADMIN' },
  { href: '/admin/toppings', labelVi: 'Topping', labelEn: 'Toppings', shortVi: 'Topping', shortEn: 'Toppings', icon: '🍮', group: 'ADMIN' },
  { href: '/admin/promotions', labelVi: 'Khuyến mãi', labelEn: 'Promotions', shortVi: 'Khuyến mãi', shortEn: 'Promos', icon: '🎟️', group: 'ADMIN' },
  { href: '/staff/orders', labelVi: 'Bảng đơn đang xử lý', labelEn: 'Live Orders', shortVi: 'Đơn hàng', shortEn: 'Orders', icon: '🧾', group: 'STAFF' },
  { href: '/staff/inventory', labelVi: 'Tồn kho & Mở bán', labelEn: 'Inventory & Stock', shortVi: 'Tồn kho', shortEn: 'Stock', icon: '📦', group: 'STAFF' },
];

export function AdminShell({
  children,
  currentUser,
}: {
  children: ReactNode;
  currentUser?: AdminShellUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, tx } = useLocale();
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<AdminShellUser | null>(currentUser ?? null);

  useEffect(() => {
    if (!user && typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)bl_user=([^;]+)/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(decodeURIComponent(match[1]));
          setUser(parsed);
        } catch {
          // ignore parsing error
        }
      }
    }
  }, [user]);

  const isStaff = user?.role === 'STAFF';
  const visibleNavItems = isStaff
    ? NAV_ITEMS.filter((i) => i.group === 'STAFF')
    : NAV_ITEMS;

  function isNavActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
    router.push('/login');
  }

  const homeHref = isStaff ? '/staff/orders' : '/admin';

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F5EFE6] text-[#4E311E] flex flex-col">
      {/* Header với Logo SVG chuẩn */}
      <header className="sticky top-0 z-30 h-18 bg-[#F5EFE6]/95 backdrop-blur border-b border-[#C9B29B] px-3 sm:px-8 flex items-center justify-between gap-2 shrink-0">
        <Link href={homeHref} prefetch={false} className="shrink-0">
          <BrandLogo size="sm" showBadge />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Công tắc chuyển đổi ngôn ngữ VI | EN */}
          <div className="inline-flex items-center rounded-full border border-[#9B7B60] bg-[#FCF9F2] p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                locale === 'vi' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50] hover:text-[#4E311E]'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                locale === 'en' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50] hover:text-[#4E311E]'
              }`}
            >
              EN
            </button>
          </div>

          <div className="hidden md:block text-right text-xs">
            <div className="font-bold text-[#4E311E] flex items-center justify-end gap-1.5">
              <span>{user?.fullName || user?.email || tx('Quản trị viên', 'Administrator')}</span>
              {user?.role && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#D4A373]/30 text-[#4E311E] border border-[#B59478]/40">
                  {user.role}
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8C6A50]">
              {user?.email || 'admin@brewlite.local'}
            </div>
          </div>

          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-full border border-[#9B7B60] bg-[#FCF9F2] hover:bg-[#B83B2A] hover:text-white hover:border-[#B83B2A] text-xs font-bold transition-colors"
          >
            {loggingOut ? '...' : tx('Đăng xuất', 'Sign out')}
          </button>
        </div>
      </header>

      {/* Thanh điều hướng Mobile dạng lưới cố định */}
      <div className="lg:hidden bg-[#FCF9F2] border-b border-[#C9B29B] px-3 py-2">
        <div className={`grid ${isStaff ? 'grid-cols-2' : 'grid-cols-4'} gap-1.5`}>
          {visibleNavItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-bold border text-center transition-colors ${
                  active
                    ? 'bg-[#4E311E] text-white border-[#4E311E]'
                    : 'bg-[#F3ECE1] text-[#4E311E] border-[#C9B29B]'
                }`}
              >
                <span className="text-sm leading-none mb-0.5">{item.icon}</span>
                <span className="truncate w-full">
                  {locale === 'vi' ? item.shortVi : item.shortEn}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Khung chính */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 gap-6">
        <aside className="hidden lg:flex flex-col w-64 shrink-0">
          <div className="rounded-[28px] bg-[#FCF9F2] border border-[#B59478] p-4 space-y-4">
            {!isStaff && (
              <div>
                <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#8C6A50]">
                  {tx('Quản trị hệ thống', 'Administration')}
                </p>
                <nav className="space-y-1.5">
                  {NAV_ITEMS.filter((i) => i.group === 'ADMIN').map((item) => {
                    const active = isNavActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${
                          active
                            ? 'bg-[#4E311E] text-white'
                            : 'text-[#4E311E] hover:bg-[#F3ECE1]'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{locale === 'vi' ? item.labelVi : item.labelEn}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            <div className={!isStaff ? 'pt-3 border-t border-[#C9B29B]' : ''}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#8C6A50]">
                {tx('Vận hành quầy (Staff)', 'Staff Operations')}
              </p>
              <nav className="space-y-1.5">
                {NAV_ITEMS.filter((i) => i.group === 'STAFF').map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${
                        active
                          ? 'bg-[#4E311E] text-white'
                          : 'text-[#4E311E] hover:bg-[#F3ECE1]'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{locale === 'vi' ? item.labelVi : item.labelEn}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 w-full overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}