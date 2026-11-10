'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminUserResponseDto } from '@brewlite/api-client';
import {
  LOCK_REASON_MAX_LENGTH,
  MAX_LOCK_DURATION_DAYS,
  businessDay,
  endOfBusinessDay,
} from '@brewlite/contracts';
import {
  changeRole,
  deactivateUser,
  lockUser,
  restoreUser,
  unlockUser,
} from '@/actions/admin/users';
import { formatDay } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { UserStatus } from '@/lib/admin/user-status';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { lastLockedDay } from './UserBadges';
import { useAdminError } from './useAdminError';

const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
type Dialog = 'role' | 'lock' | 'deactivate' | null;

/**
 * *Access* (decision 7): Role, Lock and Deactivate, one row each with its sentence. On your own
 * account all three are disabled with the reason linked by `aria-describedby`; while deactivated,
 * role and lock are disabled and the row offers *Restore account*. The API refuses the same things
 * (`SELF_ACTION_FORBIDDEN`, `LAST_ADMIN`) — its words show inside the dialog.
 */
export function UserAccess({
  user,
  status,
  isSelf,
}: Readonly<{ user: AdminUserResponseDto; status: UserStatus; isSelf: boolean }>) {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language as Locale;
  const router = useRouter();
  const message = useAdminError();
  const reasonId = useId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [role, setRole] = useState<(typeof ROLES)[number]>(
    ROLES.find((r) => r !== user.role) ?? 'STAFF',
  );
  const [reason, setReason] = useState(user.lockReason ?? '');
  const [until, setUntil] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ reason?: string; until?: string }>({});

  const deactivated = status.kind === 'deactivated';
  const locked = status.kind === 'locked';
  const blocked = isSelf || deactivated;
  const name = user.fullName;

  const open = (which: Exclude<Dialog, null>) => {
    setError(null);
    setFieldErrors({});
    setDialog(which);
  };
  const act = (call: () => Promise<{ ok: boolean; code?: string; details?: unknown }>) =>
    start(async () => {
      const res = await call();
      if (res.ok) {
        setDialog(null);
        return router.refresh();
      }
      setError(message(res.code ?? 'INTERNAL', res.details));
    });

  const submitLock = () => {
    const found: { reason?: string; until?: string } = {};
    if (reason.trim() === '') found.reason = t('users.lockDialog.needReason');
    let lockedUntil: string | undefined;
    if (until) {
      const end = endOfBusinessDay(until);
      const today = businessDay(new Date());
      if (until < today) found.until = t('users.lockDialog.past');
      else if (end.getTime() - Date.now() > MAX_LOCK_DURATION_DAYS * 86_400_000) {
        found.until = t('users.lockDialog.tooFar');
      } else lockedUntil = end.toISOString();
    }
    setFieldErrors(found);
    if (found.reason || found.until) return;
    act(() => lockUser(user.id, { reason: reason.trim(), ...(lockedUntil && { lockedUntil }) }));
  };

  const row =
    'border-base-300 flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-t-0';
  const btn = 'btn btn-outline min-h-11';
  const why = isSelf
    ? t('users.access.own')
    : deactivated
      ? t('users.access.deactivatedNote')
      : null;
  const describedBy = why ? reasonId : undefined;

  return (
    <section
      aria-labelledby="access-title"
      className="border-base-300 bg-base-100 rounded-box border p-6"
    >
      <h2 id="access-title" className="text-xl font-semibold">
        {t('users.access.title')}
      </h2>
      {why && (
        <p id={reasonId} className="text-base-content/70 mt-1 text-sm">
          {why}
        </p>
      )}

      <div className={row}>
        <div className="max-w-xl">
          <h3 className="font-semibold">{t('users.access.role')}</h3>
          <p className="text-base-content/70 text-sm">{t('users.access.roleBody')}</p>
        </div>
        <button
          type="button"
          className={btn}
          disabled={blocked}
          aria-describedby={describedBy}
          onClick={() => open('role')}
        >
          {t('users.access.changeRole')}
        </button>
      </div>

      <div className={row}>
        <div className="max-w-xl">
          <h3 className="font-semibold">{t('users.access.lock')}</h3>
          <p className="text-base-content/70 text-sm">{t('users.access.lockBody')}</p>
          {locked && (
            <div className="bg-warning/15 rounded-box mt-3 px-4 py-3 text-sm">
              <p className="font-semibold">
                {t('users.access.lockedBlock', { reason: user.lockReason ?? '' })}
              </p>
              <p>
                {status.until
                  ? t('users.access.lockedEnd', {
                      day: formatDay(lastLockedDay(status.until), locale, true),
                    })
                  : t('users.access.lockedForever')}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {locked && (
            <button
              type="button"
              className={btn}
              disabled={blocked}
              aria-describedby={describedBy}
              onClick={() => act(() => unlockUser(user.id))}
            >
              {t('users.access.unlock')}
            </button>
          )}
          <button
            type="button"
            className={btn}
            disabled={blocked}
            aria-describedby={describedBy}
            onClick={() => open('lock')}
          >
            {locked ? t('users.access.changeLock') : t('users.access.lockAction')}
          </button>
        </div>
      </div>

      <div className={row}>
        <div className="max-w-xl">
          <h3 className="font-semibold">{t('users.access.deactivate')}</h3>
          <p className="text-base-content/70 text-sm">{t('users.access.deactivateBody')}</p>
        </div>
        {deactivated ? (
          <button
            type="button"
            className={btn}
            disabled={isSelf}
            onClick={() => act(() => restoreUser(user.id))}
          >
            {t('users.access.restore')}
          </button>
        ) : (
          <button
            type="button"
            className={`${btn} btn-error`}
            disabled={blocked}
            aria-describedby={describedBy}
            onClick={() => open('deactivate')}
          >
            {t('users.access.deactivateAction')}
          </button>
        )}
      </div>
      {error && !dialog && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}

      {dialog === 'role' && (
        <AdminConfirmDialog
          title={t('users.roleConfirm.title', { name, role: t(`users.role.${role}`) })}
          body={t('users.roleConfirm.body')}
          confirmLabel={t('users.roleConfirm.confirm')}
          tone="primary"
          pending={pending}
          error={error}
          onConfirm={() => act(() => changeRole(user.id, { role }))}
          onClose={() => setDialog(null)}
        >
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('users.access.role')}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="select"
            >
              {ROLES.filter((r) => r !== user.role).map((r) => (
                <option key={r} value={r}>
                  {t(`users.role.${r}`)}
                </option>
              ))}
            </select>
          </label>
        </AdminConfirmDialog>
      )}

      {dialog === 'lock' && (
        <AdminConfirmDialog
          title={t('users.lockDialog.title', { name })}
          body={t('users.lockDialog.body')}
          confirmLabel={t('users.lockDialog.confirm')}
          pending={pending}
          error={error}
          onConfirm={submitLock}
          onClose={() => setDialog(null)}
        >
          <label className="flex flex-col gap-1">
            <span className="font-medium">
              {t('users.lockDialog.reason')}{' '}
              <span className="text-base-content/70 text-sm font-normal">
                {t('users.lockDialog.reasonHint')}
              </span>
            </span>
            <textarea
              value={reason}
              maxLength={LOCK_REASON_MAX_LENGTH}
              rows={3}
              aria-invalid={fieldErrors.reason ? true : undefined}
              onChange={(e) => setReason(e.target.value)}
              className={`textarea w-full ${fieldErrors.reason ? 'border-error' : ''}`}
            />
            {fieldErrors.reason && <span className="text-error text-sm">{fieldErrors.reason}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('users.lockDialog.until')}</span>
            <input
              type="date"
              value={until}
              aria-invalid={fieldErrors.until ? true : undefined}
              onChange={(e) => setUntil(e.target.value)}
              className={`input w-52 ${fieldErrors.until ? 'border-error' : ''}`}
            />
            <span className="text-base-content/70 text-sm">{t('users.lockDialog.untilHint')}</span>
            {fieldErrors.until && <span className="text-error text-sm">{fieldErrors.until}</span>}
          </label>
        </AdminConfirmDialog>
      )}

      {dialog === 'deactivate' && (
        <AdminConfirmDialog
          title={t('users.deactivateDialog.title', { name })}
          body={t('users.deactivateDialog.body')}
          confirmLabel={t('users.deactivateDialog.confirm')}
          pending={pending}
          error={error}
          onConfirm={() => act(() => deactivateUser(user.id))}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
