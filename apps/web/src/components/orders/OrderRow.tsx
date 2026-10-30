import Link from 'next/link';
import type { OrderResponseDto } from '@brewlite/api-client';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import { formatOrderDate } from '@/lib/order-date';
import { OrderTicket } from '../order/OrderTicket';
import { StatusBadge } from '../order/StatusBadge';

/** *Cà phê sữa đá ×2, Croissant* — names in the viewer's language, `×N` only when more than one. */
const summary = (order: OrderResponseDto, locale: Locale) =>
  order.lines
    .map((l) => `${localized(l.productName, locale)}${l.qty > 1 ? ` ×${l.qty}` : ''}`)
    .join(', ');

/**
 * One past order. A link (never prefetched — a list of twenty must not read twenty orders), with
 * the ticket small on the left and the facts beside it.
 */
export function OrderRow({
  order,
  locale,
  label,
}: Readonly<{ order: OrderResponseDto; locale: Locale; label: string }>) {
  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        prefetch={false}
        aria-label={label}
        className="border-base-300 rounded-box flex items-center gap-3 border p-3"
      >
        <OrderTicket orderNo={order.orderNo} size="small" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base-content/70 text-sm">
              {formatOrderDate(order.createdAt, locale)}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <p className="truncate">{summary(order, locale)}</p>
          <p className="font-bold tabular-nums">{formatVnd(order.totalVnd, locale)}</p>
        </div>
      </Link>
    </li>
  );
}
