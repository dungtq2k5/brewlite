'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUserResponseDto } from '@brewlite/api-client';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConsoleCopy } from '@/i18n/console-context';
import type { Locale } from '@/i18n/locale';
import { formatDay, formatMoment, nullableText, roleLabel, roleTone } from '@/lib/admin-format';
import {
  changeUserRoleAction,
  createAdminUserAction,
  deactivateUserAction,
  lockUserAction,
  restoreUserAction,
  unlockUserAction,
} from '@/lib/admin-actions';
import { runAction, type ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';
type BulkAction = 'lock' | 'unlock' | 'delete' | 'restore';

const ROLE_VALUES: Role[] = ['CUSTOMER', 'STAFF', 'ADMIN'];
const CREATE_ROLES: Role[] = ['STAFF', 'ADMIN'];

function failureMessage(result: Failure, locale: Locale): string {
  const isVi = locale === 'vi';
  if (result.code === 'VALIDATION_FAILED') {
    const issues = result.details.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      const fields = issues
        .map((issue) =>
          typeof issue === 'object' && issue !== null && 'path' in issue
            ? String((issue as { path: unknown }).path).replace(/^\//, '')
            : '',
        )
        .filter(Boolean);
      if (fields.length > 0) {
        return isVi
          ? `Thông tin chưa hợp lệ: ${[...new Set(fields)].join(', ')}.`
          : `Some fields are not valid: ${[...new Set(fields)].join(', ')}.`;
      }
    }
  }
  return describeError(result.code, result.details as ApiErrorDetails, locale);
}

function UserStatus({ user }: { user: AdminUserResponseDto }) {
  const { t } = useConsoleCopy();
  if (nullableText(user.deletedAt)) return <Tag tone="error">{t('Đã xóa', 'Deleted')}</Tag>;
  if (user.isLocked) return <Tag tone="warning">{t('Đang khóa', 'Locked')}</Tag>;
  return <Tag tone="success">{t('Hoạt động', 'Active')}</Tag>;
}

export default function UsersClient({
  rows,
  total,
  pageNumber,
  currentUserId,
  deletedOnly,
  query,
  role,
  locked,
  queryString,
}: {
  rows: AdminUserResponseDto[];
  total: number | null;
  pageNumber: number;
  currentUserId: string;
  deletedOnly: boolean;
  query: string;
  role: Role | '';
  locked: '' | 'true' | 'false';
  queryString: string;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserResponseDto | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminUserResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserResponseDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createRole, setCreateRole] = useState<Role>('STAFF');
  const [editRole, setEditRole] = useState<Role>('STAFF');
  const [lockReason, setLockReason] = useState('');
  const [lockedUntil, setLockedUntil] = useState('');

  const tabHref = (nextRole: Role | '') => {
    const params = new URLSearchParams(queryString);
    params.delete('role');
    if (nextRole) params.set('role', nextRole);
    const search = params.toString();
    return search ? `/admin/users?${search}` : '/admin/users';
  };

  const roleTabs: { value: Role | ''; label: string }[] = [
    { value: '', label: t('Tất cả', 'All') },
    ...ROLE_VALUES.map((value) => ({ value, label: roleLabel(value, locale) })),
  ];

  const close = () => {
    if (busy) return;
    setCreateOpen(false);
    setEditUser(null);
    setLockTarget(null);
    setDeleteTarget(null);
    setBulkAction(null);
    setBulkReason('');
    setError(null);
  };

  const afterWrite = (message: string) => {
    // `busy` still holds the old value inside this render, so close directly.
    setCreateOpen(false);
    setEditUser(null);
    setLockTarget(null);
    setDeleteTarget(null);
    setBulkAction(null);
    setBulkReason('');
    setError(null);
    showToast(message);
    router.refresh();
  };

  const submitCreate = async () => {
    setBusy('create');
    setError(null);
    try {
      const result = await runAction(
        createAdminUserAction({
          fullName,
          email,
          password,
          role: createRole,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      setFullName('');
      setEmail('');
      setPassword('');
      setCreateRole('STAFF');
      afterWrite(t('Đã tạo tài khoản.', 'Account created.'));
    } finally {
      setBusy(null);
    }
  };

  const submitRole = async () => {
    if (!editUser) return;
    setBusy('role');
    setError(null);
    try {
      const result = await runAction(changeUserRoleAction({ userId: editUser.id, role: editRole }));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã đổi vai trò.', 'Role updated.'));
    } finally {
      setBusy(null);
    }
  };

  const submitLock = async () => {
    if (!lockTarget) return;
    setBusy('lock');
    setError(null);
    try {
      const result = await runAction(
        lockUserAction({
          userId: lockTarget.id,
          reason: lockReason,
          lockedUntil: lockedUntil ? new Date(lockedUntil).toISOString() : undefined,
        }),
      );
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      setLockReason('');
      setLockedUntil('');
      afterWrite(t('Đã khóa tài khoản.', 'Account locked.'));
    } finally {
      setBusy(null);
    }
  };

  const unlock = async (user: AdminUserResponseDto) => {
    setBusy(user.id);
    setError(null);
    try {
      const result = await runAction(unlockUserAction(user.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã mở khóa tài khoản.', 'Account unlocked.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    try {
      const result = await runAction(deactivateUserAction(deleteTarget.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      afterWrite(t('Đã xóa mềm tài khoản.', 'Account soft-deleted.'));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (user: AdminUserResponseDto) => {
    setBusy(user.id);
    setError(null);
    try {
      const result = await runAction(restoreUserAction(user.id));
      if (!result.ok) {
        setError(failureMessage(result, locale));
        return;
      }
      showToast(t('Đã khôi phục tài khoản.', 'Account restored.'));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const selectable = rows.filter((user) => {
    if (user.id === currentUserId) return false;
    return deletedOnly ? Boolean(nullableText(user.deletedAt)) : !nullableText(user.deletedAt);
  });
  const selectedUsers = rows.filter((user) => selected.has(user.id));
  const selectedCount = selectedUsers.length;
  const allSelected = selectable.length > 0 && selectable.every((user) => selected.has(user.id));
  const someSelected = selectable.some((user) => selected.has(user.id));

  useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleUser = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectable.map((user) => user.id)));
  };

  const selectedLockable = selectedUsers.filter(
    (user) => !user.isLocked && !nullableText(user.deletedAt),
  ).length;
  const selectedUnlockable = selectedUsers.filter(
    (user) => user.isLocked && !nullableText(user.deletedAt),
  ).length;
  const selectedDeletable = selectedUsers.filter((user) => !nullableText(user.deletedAt)).length;
  const selectedRestorable = selectedUsers.filter((user) =>
    Boolean(nullableText(user.deletedAt)),
  ).length;

  const bulkTargets = selectedUsers.filter((user) => {
    if (bulkAction === 'lock') return !user.isLocked && !nullableText(user.deletedAt);
    if (bulkAction === 'unlock') return user.isLocked && !nullableText(user.deletedAt);
    if (bulkAction === 'delete') return !nullableText(user.deletedAt);
    if (bulkAction === 'restore') return Boolean(nullableText(user.deletedAt));
    return false;
  });

  const runBulk = async () => {
    if (!bulkAction || bulkTargets.length === 0) return;
    setBusy('bulk');
    setError(null);
    const failed = new Set<string>();
    let firstFailure: Failure | null = null;
    let succeeded = 0;

    try {
      for (const user of bulkTargets) {
        const result = await runAction(
          bulkAction === 'lock'
            ? lockUserAction({ userId: user.id, reason: bulkReason.trim() })
            : bulkAction === 'unlock'
              ? unlockUserAction(user.id)
              : bulkAction === 'delete'
                ? deactivateUserAction(user.id)
                : restoreUserAction(user.id),
        );
        if (result.ok) {
          succeeded += 1;
        } else {
          failed.add(user.id);
          firstFailure ??= result;
        }
      }

      setSelected(failed);
      if (succeeded > 0) {
        const message =
          bulkAction === 'lock'
            ? t(
                `Đã khóa ${succeeded} tài khoản.`,
                `Locked ${succeeded} ${succeeded === 1 ? 'account' : 'accounts'}.`,
              )
            : bulkAction === 'unlock'
              ? t(
                  `Đã mở khóa ${succeeded} tài khoản.`,
                  `Unlocked ${succeeded} ${succeeded === 1 ? 'account' : 'accounts'}.`,
                )
              : bulkAction === 'delete'
                ? t(
                    `Đã xóa mềm ${succeeded} tài khoản.`,
                    `Soft-deleted ${succeeded} ${succeeded === 1 ? 'account' : 'accounts'}.`,
                  )
                : t(
                    `Đã khôi phục ${succeeded} tài khoản.`,
                    `Restored ${succeeded} ${succeeded === 1 ? 'account' : 'accounts'}.`,
                  );
        showToast(message);
        router.refresh();
      }
      if (firstFailure) {
        setError(failureMessage(firstFailure, locale));
        if (succeeded > 0) {
          setBulkAction(null);
          setBulkReason('');
        }
        return;
      }
      setBulkAction(null);
      setBulkReason('');
    } finally {
      setBusy(null);
    }
  };

  const bulkTitle =
    bulkAction === 'lock'
      ? t('Khóa tài khoản đã chọn', 'Lock selected accounts')
      : bulkAction === 'unlock'
        ? t('Mở khóa tài khoản đã chọn', 'Unlock selected accounts')
        : bulkAction === 'delete'
          ? t('Xóa mềm tài khoản đã chọn', 'Soft-delete selected accounts')
          : t('Khôi phục tài khoản đã chọn', 'Restore selected accounts');
  const bulkConfirm =
    bulkAction === 'lock'
      ? t('Khóa tài khoản', 'Lock accounts')
      : bulkAction === 'unlock'
        ? t('Mở khóa', 'Unlock')
        : bulkAction === 'delete'
          ? t('Xóa mềm', 'Soft delete')
          : t('Khôi phục', 'Restore');

  return (
    <>
      <PageHead
        title={t('Người dùng', 'Users')}
        meta={t(`${total ?? rows.length} tài khoản`, `${total ?? rows.length} accounts`)}
        lede={t(
          'Tạo tài khoản Staff/Admin, đổi vai trò, khóa tạm thời và xóa mềm. Mọi thao tác được kiểm tra quyền ở gateway.',
          'Create Staff/Admin accounts, change roles, lock temporarily and soft delete. The gateway checks permissions for every action.',
        )}
        actions={
          <Button
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
          >
            {t('Tạo tài khoản', 'Create account')}
          </Button>
        }
      />

      {error && !createOpen && !editUser && !lockTarget && !deleteTarget && !bulkAction && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <nav className="filter-tabs" aria-label={t('Lọc theo vai trò', 'Filter by role')}>
          {roleTabs.map((tab) => (
            <a
              key={tab.value || 'all'}
              className={`filter-tab${role === tab.value ? ' is-active' : ''}`}
              href={tabHref(tab.value)}
              aria-current={role === tab.value ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        <form className="toolbar" action="/admin/users" method="get">
          <input type="hidden" name="role" value={role} />
          <div className="field">
            <label htmlFor="user-q">
              {t('Tìm theo tên hoặc email', 'Search by name or email')}
            </label>
            <input
              id="user-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="staff@brewlite.test"
            />
          </div>
          <div className="field">
            <label htmlFor="user-locked">{t('Trạng thái', 'Status')}</label>
            <select id="user-locked" className="input" name="locked" defaultValue={locked}>
              <option value="">{t('Tất cả', 'All')}</option>
              <option value="false">{t('Hoạt động', 'Active')}</option>
              <option value="true">{t('Đang khóa', 'Locked')}</option>
            </select>
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              {t('Chỉ tài khoản đã xóa', 'Deleted accounts only')}
              <small>
                {t(
                  'Bật để khôi phục tài khoản đã xóa mềm.',
                  'Use this to restore soft-deleted accounts.',
                )}
              </small>
            </span>
          </label>
          <Button type="submit">{t('Lọc', 'Filter')}</Button>
          {(query || role || locked || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/users">
              {t('Xóa lọc', 'Clear filter')}
            </a>
          )}
        </form>

        {selectedCount > 0 && (
          <div
            className="bulk-bar"
            role="region"
            aria-label={t('Thao tác hàng loạt', 'Bulk actions')}
          >
            <p className="bulk-count" aria-live="polite">
              {selectedCount === 1
                ? t('Đã chọn 1 tài khoản', '1 account selected')
                : t(`Đã chọn ${selectedCount} tài khoản`, `${selectedCount} accounts selected`)}
            </p>
            <div className="bulk-actions">
              {deletedOnly ? (
                <Button
                  size="sm"
                  disabled={busy !== null || selectedRestorable === 0}
                  onClick={() => {
                    setError(null);
                    setBulkAction('restore');
                  }}
                >
                  {t(`Khôi phục (${selectedRestorable})`, `Restore (${selectedRestorable})`)}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={busy !== null || selectedLockable === 0}
                    onClick={() => {
                      setError(null);
                      setBulkReason('');
                      setBulkAction('lock');
                    }}
                  >
                    {t(`Khóa (${selectedLockable})`, `Lock (${selectedLockable})`)}
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={busy !== null || selectedUnlockable === 0}
                    onClick={() => {
                      setError(null);
                      setBulkAction('unlock');
                    }}
                  >
                    {t(`Mở khóa (${selectedUnlockable})`, `Unlock (${selectedUnlockable})`)}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy !== null || selectedDeletable === 0}
                    onClick={() => {
                      setError(null);
                      setBulkAction('delete');
                    }}
                  >
                    {t(`Xóa mềm (${selectedDeletable})`, `Soft delete (${selectedDeletable})`)}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="quiet"
                disabled={busy !== null}
                onClick={() => setSelected(new Set())}
              >
                {t('Bỏ chọn', 'Clear selection')}
              </Button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              title={
                deletedOnly
                  ? t('Không có tài khoản đã xóa', 'No deleted accounts')
                  : t('Chưa có người dùng', 'No users yet')
              }
            >
              {deletedOnly
                ? t(
                    'Không có tài khoản nào bị xóa mềm khớp bộ lọc.',
                    'No soft-deleted account matches the filter.',
                  )
                : t(
                    'Tạo tài khoản Staff hoặc Admin đầu tiên bằng nút phía trên.',
                    'Create the first Staff or Admin account with the button above.',
                  )}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th className="cell-select">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      disabled={selectable.length === 0 || busy !== null}
                      onChange={toggleAll}
                      aria-label={t('Chọn tất cả trên trang', 'Select all on this page')}
                    />
                  </th>
                  <th>{t('Người dùng', 'User')}</th>
                  <th>{t('Vai trò', 'Role')}</th>
                  <th>{t('Trạng thái', 'Status')}</th>
                  <th>{t('Đăng nhập cuối', 'Last sign-in')}</th>
                  <th>{t('Ngày tạo', 'Created')}</th>
                  <th className="cell-actions">{t('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const lastLogin = nullableText(user.lastLoginAt);
                  const deleted = Boolean(nullableText(user.deletedAt));
                  const isSelf = user.id === currentUserId;
                  const canSelect = !isSelf && (deletedOnly ? deleted : !deleted);
                  return (
                    <tr key={user.id}>
                      <td className="cell-select">
                        {canSelect ? (
                          <input
                            type="checkbox"
                            checked={selected.has(user.id)}
                            disabled={busy !== null}
                            onChange={() => toggleUser(user.id)}
                            aria-label={t(`Chọn ${user.fullName}`, `Select ${user.fullName}`)}
                          />
                        ) : (
                          <span
                            className="muted"
                            title={
                              isSelf
                                ? t('Không thể chọn chính mình', 'You cannot select yourself')
                                : undefined
                            }
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td data-label={t('Người dùng', 'User')}>
                        <span className="cell-title">{user.fullName}</span>
                        <span className="cell-meta">{user.email}</span>
                        {user.isLocked && user.lockReason && (
                          <span className="cell-meta">
                            {t('Lý do khóa:', 'Lock reason:')} {user.lockReason}
                          </span>
                        )}
                        {user.isLocked && user.lockedUntil && (
                          <span className="cell-meta">
                            {t('Khóa đến', 'Locked until')}{' '}
                            {formatMoment(nullableText(user.lockedUntil), locale)}
                          </span>
                        )}
                      </td>
                      <td data-label={t('Vai trò', 'Role')}>
                        <Tag tone={roleTone(user.role)}>{roleLabel(user.role, locale)}</Tag>
                      </td>
                      <td data-label={t('Trạng thái', 'Status')}>
                        <UserStatus user={user} />
                      </td>
                      <td data-label={t('Đăng nhập cuối', 'Last sign-in')}>
                        {lastLogin ? formatMoment(lastLogin, locale) : t('Chưa có', 'Never')}
                      </td>
                      <td data-label={t('Ngày tạo', 'Created')}>
                        {formatDay(user.createdAt, locale)}
                      </td>
                      <td className="cell-actions" data-label={t('Thao tác', 'Actions')}>
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(user)}
                          >
                            {busy === user.id
                              ? t('Đang khôi phục…', 'Restoring…')
                              : t('Khôi phục', 'Restore')}
                          </Button>
                        ) : (
                          <>
                            <ButtonLink href={`/admin/users/${user.id}`} size="sm" variant="quiet">
                              {t('Chi tiết', 'Details')}
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || isSelf}
                              title={
                                isSelf
                                  ? t(
                                      'Không thể đổi vai trò của chính mình',
                                      'You cannot change your own role',
                                    )
                                  : undefined
                              }
                              onClick={() => {
                                setEditUser(user);
                                setEditRole(user.role as Role);
                                setError(null);
                              }}
                            >
                              {t('Đổi vai trò', 'Change role')}
                            </Button>
                            {user.isLocked ? (
                              <Button
                                size="sm"
                                variant="quiet"
                                disabled={busy !== null}
                                onClick={() => void unlock(user)}
                              >
                                {busy === user.id
                                  ? t('Đang mở…', 'Unlocking…')
                                  : t('Mở khóa', 'Unlock')}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="quiet"
                                disabled={busy !== null || isSelf}
                                title={
                                  isSelf
                                    ? t('Không thể khóa chính mình', 'You cannot lock yourself')
                                    : undefined
                                }
                                onClick={() => {
                                  setLockTarget(user);
                                  setError(null);
                                }}
                              >
                                {t('Khóa', 'Lock')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null || isSelf}
                              title={
                                isSelf
                                  ? t('Không thể xóa chính mình', 'You cannot delete yourself')
                                  : undefined
                              }
                              onClick={() => {
                                setDeleteTarget(user);
                                setError(null);
                              }}
                            >
                              {t('Xóa', 'Delete')}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(total ?? rows.length) > 0 && (
          <Pagination
            basePath="/admin/users"
            page={pageNumber}
            pageSize={ADMIN_PAGE_SIZE}
            total={total ?? rows.length}
            label={t('tài khoản', 'accounts')}
            query={queryString}
          />
        )}
      </Panel>

      {createOpen && (
        <Modal
          title={t('Tạo tài khoản', 'Create account')}
          meta={t(
            'Tài khoản có mật khẩu riêng; hãy gửi mật khẩu cho người dùng qua kênh an toàn.',
            'The account has its own password; share it with the user through a secure channel.',
          )}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button
                disabled={
                  busy !== null ||
                  fullName.trim().length === 0 ||
                  email.trim().length === 0 ||
                  password.length === 0
                }
                onClick={() => void submitCreate()}
              >
                {busy === 'create'
                  ? t('Đang tạo…', 'Creating…')
                  : t('Tạo tài khoản', 'Create account')}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-full-name">{t('Họ tên', 'Full name')}</label>
              <input
                id="new-full-name"
                className="input"
                value={fullName}
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="new-role">{t('Vai trò', 'Role')}</label>
              <select
                id="new-role"
                className="input"
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as Role)}
              >
                {CREATE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-email">Email</label>
            <input
              id="new-email"
              className="input"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">{t('Mật khẩu ban đầu', 'Initial password')}</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="field-hint">
              {t(
                'Từ 8 đến 72 byte, giống quy định đăng ký của khách.',
                'Between 8 and 72 bytes, the same rule as customer registration.',
              )}
            </p>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal
          title={t(`Đổi vai trò · ${editUser.fullName}`, `Change role · ${editUser.fullName}`)}
          meta={editUser.email}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button disabled={busy !== null} onClick={() => void submitRole()}>
                {busy === 'role' ? t('Đang lưu…', 'Saving…') : t('Lưu vai trò', 'Save role')}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="field">
            <label htmlFor="edit-role">{t('Vai trò', 'Role')}</label>
            <select
              id="edit-role"
              className="input"
              value={editRole}
              onChange={(event) => setEditRole(event.target.value as Role)}
            >
              {ROLE_VALUES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role, locale)}
                </option>
              ))}
            </select>
            <p className="field-hint">
              {t(
                'Đổi vai trò sẽ đăng xuất mọi phiên hiện tại của tài khoản này.',
                'Changing the role signs this account out of every active session.',
              )}
            </p>
          </div>
        </Modal>
      )}

      {lockTarget && (
        <Modal
          title={t(
            `Khóa tài khoản · ${lockTarget.fullName}`,
            `Lock account · ${lockTarget.fullName}`,
          )}
          meta={lockTarget.email}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null || lockReason.trim().length === 0}
                onClick={() => void submitLock()}
              >
                {busy === 'lock'
                  ? t('Đang khóa…', 'Locking…')
                  : t('Khóa tài khoản', 'Lock account')}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <div className="field">
            <label htmlFor="lock-reason">
              {t('Lý do', 'Reason')} <span className="muted">{t('(bắt buộc)', '(required)')}</span>
            </label>
            <textarea
              id="lock-reason"
              className="input"
              rows={3}
              maxLength={255}
              value={lockReason}
              onChange={(event) => setLockReason(event.target.value)}
              placeholder={t('Ví dụ: nghỉ việc tạm thời', 'e.g. temporary leave')}
            />
          </div>
          <div className="field">
            <label htmlFor="lock-until">
              {t('Khóa đến (không bắt buộc)', 'Lock until (optional)')}
            </label>
            <input
              id="lock-until"
              className="input"
              type="datetime-local"
              value={lockedUntil}
              onChange={(event) => setLockedUntil(event.target.value)}
            />
            <p className="field-hint">
              {t(
                'Để trống để khóa cho đến khi quản trị mở lại.',
                'Leave empty to keep the account locked until an admin unlocks it.',
              )}
            </p>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t(
            `Xóa tài khoản · ${deleteTarget.fullName}`,
            `Delete account · ${deleteTarget.fullName}`,
          )}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Giữ lại', 'Keep')}
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? t('Đang xóa…', 'Deleting…') : t('Xóa mềm', 'Soft delete')}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          <Notice tone="warning">
            {t(
              'Tài khoản sẽ bị xóa mềm và đăng xuất khỏi mọi phiên. Có thể khôi phục ở bộ lọc “Chỉ tài khoản đã xóa”.',
              'The account will be soft-deleted and signed out everywhere. Restore it with the “Deleted accounts only” filter.',
            )}
          </Notice>
        </Modal>
      )}

      {bulkAction && (
        <Modal
          title={bulkTitle}
          meta={t(
            `${bulkTargets.length} tài khoản`,
            `${bulkTargets.length} ${bulkTargets.length === 1 ? 'account' : 'accounts'}`,
          )}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                {t('Hủy', 'Cancel')}
              </Button>
              <Button
                variant={
                  bulkAction === 'lock' || bulkAction === 'delete' ? 'danger-fill' : undefined
                }
                disabled={
                  busy !== null ||
                  bulkTargets.length === 0 ||
                  (bulkAction === 'lock' && bulkReason.trim().length === 0)
                }
                onClick={() => void runBulk()}
              >
                {busy === 'bulk' ? t('Đang xử lý…', 'Working…') : bulkConfirm}
              </Button>
            </>
          }
        >
          {error && (
            <Notice tone="error" role="alert">
              {error}
            </Notice>
          )}
          {bulkAction === 'lock' ? (
            <div className="field">
              <label htmlFor="bulk-lock-reason">
                {t('Lý do', 'Reason')}{' '}
                <span className="muted">{t('(bắt buộc)', '(required)')}</span>
              </label>
              <textarea
                id="bulk-lock-reason"
                className="input"
                rows={3}
                maxLength={255}
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
                placeholder={t('Ví dụ: nghỉ việc tạm thời', 'e.g. temporary leave')}
              />
              <p className="field-hint">
                {t(
                  'Lý do này áp dụng cho mọi tài khoản được chọn. Tài khoản đang khóa sẽ được bỏ qua.',
                  'This reason applies to every selected account. Already locked accounts are skipped.',
                )}
              </p>
            </div>
          ) : (
            <Notice tone="warning">
              {bulkAction === 'unlock'
                ? t(
                    'Các tài khoản được chọn sẽ mở khóa và có thể đăng nhập lại ngay.',
                    'The selected accounts will be unlocked and can sign in again immediately.',
                  )
                : bulkAction === 'delete'
                  ? t(
                      'Các tài khoản được chọn sẽ bị xóa mềm và đăng xuất khỏi mọi phiên.',
                      'The selected accounts will be soft-deleted and signed out everywhere.',
                    )
                  : t(
                      'Các tài khoản được chọn sẽ trở lại danh sách hoạt động.',
                      'The selected accounts return to the active list.',
                    )}
            </Notice>
          )}
        </Modal>
      )}
    </>
  );
}
