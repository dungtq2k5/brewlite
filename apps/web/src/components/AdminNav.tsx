'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tag } from '@/components/vellum/Tag';

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
      <span className="rail-link is-disabled" aria-disabled="true">
        <span className="rail-num">07</span>
        <span>Đơn hàng</span>
        <Tag className="tag--p1">P1</Tag>
      </span>
      <span className="rail-link is-disabled" aria-disabled="true">
        <span className="rail-num">08</span>
        <span>Báo cáo</span>
        <Tag className="tag--p1">P1</Tag>
      </span>
    </nav>
  );
}
