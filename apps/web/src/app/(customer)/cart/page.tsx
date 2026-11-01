import { CartView } from '@/components/cart/CartView';
import { getT } from '@/i18n/server';
import { getMe } from '@/lib/me';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('cart');
  return { title: t('title') };
}

export default async function CartPage() {
  return <CartView signedIn={(await getMe()) !== null} />;
}
