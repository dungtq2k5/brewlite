'use client';

import { useTranslation } from 'react-i18next';
import { formatDay } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { UserStatus } from '@/lib/admin/user-status';

const PILL =
  'inline-flex items-center whitespace-nowrap gap-2 rounded-full px-3 py-1 text-sm font-semibold';

export function RoleBadge({ role }: Readonly<{ role: string }>) {
  const { t } = useTranslation('admin');
  const style =
    role === 'ADMIN'
      ? 'bg-neutral text-neutral-content'
      : role === 'STAFF'
        ? 'bg-secondary text-primary'
        : 'bg-base-200';
  return <span className={`${PILL} ${style}`}>{t(`users.role.${role}`)}</span>;
}

/** The last locked day is the one *before* `until` (a lock ends as the next Vietnam day starts). */
export const lastLockedDay = (until: string) => new Date(Date.parse(until) - 60_000).toISOString();

/** *Active* / *Locked until 15 Nov* / *Locked until unlocked* / *Deactivated* (`96:861`) — dot and words. */
export function UserStatusBadge({ status }: Readonly<{ status: UserStatus }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const [dot, pill, label] =
    status.kind === 'active'
      ? ['bg-success', 'bg-success/15', t('users.status.active')]
      : status.kind === 'deactivated'
        ? ['bg-base-content/40', 'bg-base-200', t('users.status.deactivated')]
        : status.until
          ? [
              'bg-warning',
              'bg-warning/20',
              t('users.status.lockedUntil', {
                day: formatDay(lastLockedDay(status.until), locale),
              }),
            ]
          : ['bg-warning', 'bg-warning/20', t('users.status.locked')];
  return (
    <span className={`${PILL} ${pill}`}>
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
