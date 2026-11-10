'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** A link that marks itself `aria-current="page"` and takes `activeClass` when it is the open section. */
export function NavLink({
  href,
  exact = false,
  className,
  activeClass,
  children,
}: Readonly<{
  href: string;
  exact?: boolean;
  className: string;
  activeClass: string;
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${className} ${active ? activeClass : ''}`}
    >
      {children}
    </Link>
  );
}
