'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useCart } from '@/context/CartContext';
import type { Locale } from '@/i18n/locale';

export default function BuyerNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const { items, hydrated } = useCart();
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const isVi = locale === 'vi';

  const tabs = [
    { href: '/', label: isVi ? 'Thực đơn' : 'Menu' },
    { href: '/orders', label: isVi ? 'Đơn hàng' : 'Orders' },
    { href: '/account', label: isVi ? 'Tài khoản' : 'Account' },
  ];

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="buyer-nav" aria-label={isVi ? 'Điều hướng khách hàng' : 'Customer navigation'}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={active(tab.href) ? 'is-active' : undefined}
          aria-current={active(tab.href) ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
      <Link
        href="/cart"
        className={active('/cart') ? 'cart-link is-active' : 'cart-link'}
        aria-current={active('/cart') ? 'page' : undefined}
      >
        {isVi ? 'Giỏ' : 'Cart'}
        {hydrated && count > 0 && <span className="cart-count">{count}</span>}
      </Link>
      <LocaleSwitcher locale={locale} />
    </nav>
  );
}
