'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import type { Locale } from '@/i18n/locale';

const ICONS = {
  menu: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
    />
  ),
  cart: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
    />
  ),
  orders: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
    />
  ),
  account: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  ),
} as const;

/** The compact customer navigation shown only under 48rem. */
export default function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const { items, hydrated } = useCart();
  const isVi = locale === 'vi';
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  const tabs = [
    { href: '/', label: isVi ? 'Thực đơn' : 'Menu', icon: ICONS.menu },
    {
      href: '/cart',
      label: isVi ? 'Giỏ hàng' : 'Cart',
      icon: ICONS.cart,
      badge: hydrated && count > 0 ? count : null,
    },
    { href: '/orders', label: isVi ? 'Đơn hàng' : 'Orders', icon: ICONS.orders },
    { href: '/account', label: isVi ? 'Tài khoản' : 'Account', icon: ICONS.account },
  ];

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="buyer-bottom-nav" aria-label={isVi ? 'Điều hướng nhanh' : 'Quick navigation'}>
      {tabs.map((tab) => {
        const isActive = active(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={isActive ? 'is-active' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              {tab.icon}
            </svg>
            <span>{tab.label}</span>
            {'badge' in tab && tab.badge ? (
              <span className="cart-count" aria-hidden="true">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
