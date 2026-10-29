'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/users', label: 'Người dùng' },
  { href: '/admin/products', label: 'Sản phẩm' },
  { href: '/admin/categories', label: 'Danh mục' },
  { href: '/admin/toppings', label: 'Topping' },
  { href: '/admin/promotions', label: 'Khuyến mãi' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="rail-nav" aria-label="Điều hướng quản trị">
      {LINKS.map((link, index) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'rail-link is-active' : 'rail-link'}
            aria-current={active ? 'page' : undefined}
          >
            <span className="rail-num">{String(index + 1).padStart(2, '0')}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
