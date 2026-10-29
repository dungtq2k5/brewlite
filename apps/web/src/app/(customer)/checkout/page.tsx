import { getLocale } from '@/i18n/locale.server';
import { requireUser } from '@/lib/session';
import CheckoutPageClient from './CheckoutPageClient';

export default async function CheckoutPage() {
  const [user, locale] = await Promise.all([requireUser('/checkout'), getLocale()]);

  return (
    <CheckoutPageClient
      locale={locale}
      recipient={{ fullName: user.fullName, email: user.email }}
    />
  );
}
