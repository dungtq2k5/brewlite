import { notFound } from 'next/navigation';
import { adminOrdersControllerGet, ApiClientError } from '@brewlite/api-client';
import { AdminOrderView } from '@/components/admin/AdminOrderView';
import { getT } from '@/i18n/server';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('orders.title') };
}

export default async function AdminOrderPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const res = await adminOrdersControllerGet(id).catch((error: unknown) => {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400))
      notFound();
    throw withRequestId(error);
  });
  if (res.status !== 200 || !res.data.data) notFound();
  const order = res.data.data;
  const flags = res.data.meta?.degraded ?? [];
  return (
    <AdminOrderView
      order={order}
      degraded={{ payment: flags.includes('payment'), identity: flags.includes('identity') }}
    />
  );
}
