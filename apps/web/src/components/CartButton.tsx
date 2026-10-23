'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useCartCount } from './useCartCount';

export function CartButton() {
  const { t } = useTranslation('common');
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      prefetch={false}
      aria-label={count > 0 ? t('header.cartCount', { count }) : t('header.cart')}
      className="relative grid min-h-11 min-w-11 place-items-center"
    >
      <ShoppingBag aria-hidden size={24} strokeWidth={2} />
      {count > 0 && (
        <span
          aria-hidden
          className="bg-accent text-accent-content absolute top-0.5 right-0 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-bold"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
