import { barShares, type Day } from '@/lib/admin/sales';

/**
 * Plain CSS bars (`96:1137`): one per day, its height a share of the busiest day, a thin base line
 * for a zero day. Decoration only (`aria-hidden`) — the per-day table under it is the accessible
 * equivalent (decision 12). No chart library.
 */
export function SalesChart({ days }: Readonly<{ days: readonly Day[] }>) {
  const shares = barShares(days);
  return (
    <div aria-hidden className="border-base-300 flex h-48 items-end gap-1 border-b">
      {days.map((d, i) => (
        <div
          key={d.day}
          className={`min-w-0 flex-1 rounded-t ${shares[i]! > 0 ? 'bg-primary' : 'bg-base-300'}`}
          style={{ height: shares[i]! > 0 ? `${Math.max(shares[i]! * 100, 2)}%` : '2px' }}
        />
      ))}
    </div>
  );
}
