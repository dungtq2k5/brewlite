'use client';

import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

const SECTIONS = ['categories', 'products', 'toppings', 'promotions', 'users', 'orders'] as const;

/**
 * The section's name in the top bar. The page's own `<h1>` says what is open; this is a label, so
 * it is not a heading (one `h1` per page).
 */
export function AdminBarTitle() {
  const { t } = useTranslation('admin');
  const path = usePathname();
  const section = SECTIONS.find((s) => path === `/admin/${s}` || path.startsWith(`/admin/${s}/`));
  return <p className="text-2xl font-semibold">{t(`bar.${section ?? 'overview'}`)}</p>;
}
