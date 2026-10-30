import { ordersControllerListMyOrders } from '@brewlite/api-client';
import { OrderList } from '@/components/orders/OrderList';
import { getT } from '@/i18n/server';
import { withRequestId } from '@/lib/with-request-id';

export async function generateMetadata() {
  const { t } = await getT('orders');
  return { title: t('title') };
}

/** `/orders` — the customer's orders, newest first, twenty at a time. */
export default async function OrdersPage() {
  const [{ t }, res] = await Promise.all([
    getT('orders'),
    ordersControllerListMyOrders({ limit: 20 }).catch((error: unknown) => {
      throw withRequestId(error);
    }),
  ]);
  const orders = res.status === 200 ? (res.data.data ?? []) : [];
  const nextCursor = res.status === 200 ? (res.data.meta?.nextCursor ?? null) : null;
  return (
    <div className="mx-auto max-w-xl py-4 lg:py-8">
      <h1 className="mb-4 text-3xl font-bold">{t('title')}</h1>
      <OrderList initial={orders} nextCursor={nextCursor} />
    </div>
  );
}
