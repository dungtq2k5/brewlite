import { CheckoutView } from '@/components/checkout/CheckoutView';
import { getT } from '@/i18n/server';

export async function generateMetadata() {
  const { t } = await getT('checkout');
  return { title: t('title') };
}

/** `/checkout` — the proxy has already sent a guest to sign in and back (ADR 0029). */
export default function CheckoutPage() {
  return <CheckoutView />;
}
