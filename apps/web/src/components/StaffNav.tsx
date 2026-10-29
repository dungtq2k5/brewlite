'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StaffNav() {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="console-nav" aria-label="Điều hướng nhân viên">
      <Link href="/staff" className={active('/staff') ? 'is-active' : undefined}>
        Bảng đơn
      </Link>
      <Link href="/staff/stock" className={active('/staff/stock') ? 'is-active' : undefined}>
        Kho &amp; món
      </Link>
    </nav>
  );
}
