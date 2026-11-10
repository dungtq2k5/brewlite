import { adminToppingsControllerList } from '@brewlite/api-client';
import { ToppingsView } from '@/components/admin/ToppingsView';
import { getT } from '@/i18n/server';
import { readFlag, type RawParams } from '@/lib/admin/list-params';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('topping.title') };
}

export default async function ToppingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const deleted = readFlag(await searchParams, 'deleted');
  const res = await adminToppingsControllerList({ deleted: deleted ? 'true' : 'false' }).catch(
    (error: unknown) => {
      throw withRequestId(error);
    },
  );
  return (
    <ToppingsView toppings={res.status === 200 ? (res.data.data ?? []) : []} deleted={deleted} />
  );
}
