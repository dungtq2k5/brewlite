import { CheckoutView } from '@/components/checkout/CheckoutView';
import { getT } from '@/i18n/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('checkout');
  return { title: t('title') };
}

/** `/checkout` — the proxy has already sent a guest to sign in and back (ADR 0029). */
export default function CheckoutPage() {
  return <CheckoutView />;
}
