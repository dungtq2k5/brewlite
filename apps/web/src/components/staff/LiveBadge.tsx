'use client';

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getLive, getLiveOnServer, subscribeLive } from '@/lib/staff/live-status';

/** *● Live* / *Reconnecting…* in the top bar — only while a board is following the stream. */
export function LiveBadge() {
  const { t } = useTranslation('staff');
  const { active, live, reconnecting } = useSyncExternalStore(
    subscribeLive,
    getLive,
    getLiveOnServer,
  );
  if (!active) return null;
  if (reconnecting) {
    return (
      <span role="status" className="text-warning text-sm font-medium">
        {t('reconnecting')}
      </span>
    );
  }
  return live ? (
    <span className="text-success flex items-center gap-1 text-sm font-medium">
      <span aria-hidden className="bg-success size-2 rounded-full" />
      {t('live')}
    </span>
  ) : null;
}
