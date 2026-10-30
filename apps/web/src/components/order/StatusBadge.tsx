import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PILL = 'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold';

/**
 * The status as a label — never colour alone: a dot or a check precedes the words. READY is the
 * loud one (filled success, a check); PAID is the blue pill; COMPLETED is quiet; CANCELLED is
 * struck through.
 */
export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const { t } = useTranslation('orders');
  const label = t(`status.${status}`);
  const dot = (color: string) => <span aria-hidden className={`${color} size-2 rounded-full`} />;
  switch (status) {
    case 'READY':
      return (
        <span className={`${PILL} bg-success text-success-content font-bold`}>
          <Check aria-hidden size={16} />
          {label}
        </span>
      );
    case 'PAID':
      return (
        <span className={`${PILL} bg-info text-info-content`}>
          {dot('bg-info-content')}
          {label}
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="text-base-content/70 inline-flex items-center gap-1 text-sm font-medium">
          <Check aria-hidden size={16} />
          {label}
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="text-base-content/70 inline-flex items-center gap-2 text-sm font-medium line-through">
          {dot('bg-base-content/40')}
          {label}
        </span>
      );
    case 'PAYMENT_FAILED':
      return (
        <span className={`${PILL} bg-error/10 text-error`}>
          {dot('bg-error')}
          {label}
        </span>
      );
    default:
      return (
        <span className={`${PILL} bg-secondary text-primary`}>
          {dot('bg-primary')}
          {label}
        </span>
      );
  }
}
