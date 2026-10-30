import Link from 'next/link';
import type { LoyaltyResponseDto } from '@brewlite/api-client';
import { getLocale, getT } from '@/i18n/server';
import { formatOrderDate } from '@/lib/order-date';

const KEY = {
  EARN: 'points.earned',
  EARN_REVERSED: 'points.reversed',
  REDEEM: 'points.redeemed',
  REDEEM_RETURNED: 'points.returned',
} as const;

/** One movement of the ledger: what happened on which order, when, and how many points. */
export async function LedgerRow({
  entry,
}: Readonly<{ entry: LoyaltyResponseDto['recent'][number] }>) {
  const [{ t }, locale] = await Promise.all([getT('account'), getLocale()]);
  return (
    <li className="border-base-300 border-b last:border-b-0">
      <Link
        href={`/orders/${entry.orderId}`}
        prefetch={false}
        className="flex min-h-11 items-center justify-between gap-3 py-2"
      >
        <span>
          {t(KEY[entry.kind], { no: entry.orderNo })}
          <span className="text-base-content/70 block text-sm">
            {formatOrderDate(entry.at, locale)}
          </span>
        </span>
        <span
          className={`font-bold tabular-nums ${entry.points < 0 ? 'text-error' : 'text-success'}`}
        >
          {entry.points > 0 ? `+${entry.points}` : entry.points}
        </span>
      </Link>
    </li>
  );
}
