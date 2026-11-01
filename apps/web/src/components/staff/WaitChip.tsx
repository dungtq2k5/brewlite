import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isLongWait, waitLabel } from '@/lib/staff/wait';

/**
 * How long the order has been paid, as minutes. The warning is colour **and** the minutes text,
 * so it still reads without the colour.
 */
export function WaitChip({ minutes }: Readonly<{ minutes: number }>) {
  const { t } = useTranslation('staff');
  const label = waitLabel(minutes);
  const long = isLongWait(minutes);
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-sm font-semibold tabular-nums ${
        long ? 'bg-warning text-warning-content' : 'bg-base-200'
      }`}
    >
      <Clock aria-hidden size={14} />
      {label.key === 'now' ? t('wait.now') : t('wait.min', { count: label.count })}
    </span>
  );
}
