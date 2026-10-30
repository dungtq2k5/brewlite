import type { OrderResponseDto } from '@brewlite/api-client';
import { useTranslation } from 'react-i18next';
import { Alert } from '../Alert';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';

const TYPE = { PENDING: 'info', REFUNDED: 'success', FAILED: 'error' } as const;

/** Shown for a cancelled order that was paid: the refund is always the whole total (rdm-spec P-2). */
export function RefundNotice({ order }: Readonly<{ order: OrderResponseDto }>) {
  const { t, i18n } = useTranslation('orders');
  const status = order.refundStatus as keyof typeof TYPE;
  if (order.status !== 'CANCELLED' || !order.paidAt || !(status in TYPE)) return null;
  return (
    <Alert type={TYPE[status]}>
      {t(`order.refund.${status}`, {
        amount: formatVnd(order.totalVnd, i18n.language as Locale),
        no: `#${order.orderNo}`,
      })}
    </Alert>
  );
}
