import { getLocale } from '@/i18n/locale.server';
import CartPageClient from './CartPageClient';

export default async function CartPage() {
  const locale = await getLocale();
  return <CartPageClient locale={locale} />;
}
