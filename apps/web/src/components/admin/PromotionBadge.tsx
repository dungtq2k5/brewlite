'use client';

import { useTranslation } from 'react-i18next';
import type { PromotionState } from '@/lib/admin/promotion-state';

const STYLE: Record<PromotionState, { pill: string; dot: string }> = {
  running: { pill: 'bg-success/15', dot: 'bg-success' },
  scheduled: { pill: 'bg-info/15', dot: 'bg-info' },
  ended: { pill: 'bg-base-200', dot: 'bg-base-content/40' },
  usedUp: { pill: 'bg-warning/20', dot: 'bg-warning' },
  switchedOff: { pill: 'bg-base-200', dot: 'bg-base-content/40' },
};

/** The state as a pill with a dot *and* the word (`96:843`) — never colour alone. */
export function PromotionBadge({ state }: Readonly<{ state: PromotionState }>) {
  const { t } = useTranslation('admin');
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${STYLE[state].pill}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${STYLE[state].dot}`} />
      {t(`promo.state.${state}`)}
    </span>
  );
}
