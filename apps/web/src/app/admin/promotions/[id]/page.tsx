import { notFound } from 'next/navigation';
import { ApiClientError, promotionsControllerGet } from '@brewlite/api-client';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { getT } from '@/i18n/server';
import { withRequestId } from '@/lib/with-request-id';
import { mono } from '../mono';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('promo.title') };
}

export default async function EditPromotionPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const res = await promotionsControllerGet(id).catch((error: unknown) => {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400))
      notFound();
    throw withRequestId(error);
  });
  if (res.status !== 200 || !res.data.data) notFound();
  return (
    <PromotionForm promotion={res.data.data} today="" inThirtyDays="" codeFont={mono.className} />
  );
}
