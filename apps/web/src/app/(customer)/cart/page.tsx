import { CartView } from '@/components/cart/CartView';
import { getT } from '@/i18n/server';
import { getMe } from '@/lib/me';

export async function generateMetadata() {
  const { t } = await getT('cart');
  return { title: t('title') };
}

export default async function CartPage() {
  return <CartView signedIn={(await getMe()) !== null} />;
}
