import { businessDay } from '@brewlite/contracts';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { getT } from '@/i18n/server';
import { mono } from '../mono';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('promo.titleNew') };
}

export default function NewPromotionPage() {
  const now = new Date();
  const plus30 = new Date(now.getTime() + 30 * 86_400_000);
  return (
    <PromotionForm
      today={businessDay(now)}
      inThirtyDays={businessDay(plus30)}
      codeFont={mono.className}
    />
  );
}
