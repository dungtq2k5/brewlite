'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUserResponseDto } from '@brewlite/api-client';
import { Button } from '@/components/vellum/Button';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Modal } from '@/components/vellum/Modal';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatDay, formatMoment, nullableText, roleLabel, roleTone } from '@/lib/admin-format';
import {
  changeUserRoleAction,
  createAdminUserAction,
  deactivateUserAction,
  lockUserAction,
  restoreUserAction,
  unlockUserAction,
} from '@/lib/admin-actions';
import type { ActionResult } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'CUSTOMER', label: 'Khách hàng' },
  { value: 'STAFF', label: 'Nhân viên' },
  { value: 'ADMIN', label: 'Quản trị' },
];

const CREATE_ROLES: Role[] = ['STAFF', 'ADMIN'];

function failureMessage(result: Failure): string {
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
        return `Thông tin chưa hợp lệ: ${[...new Set(fields)].join(', ')}.`;
      }
    }
  }
  return describeError(result.code, result.details as ApiErrorDetails, 'vi');
}

function UserStatus({ user }: { user: AdminUserResponseDto }) {
  if (nullableText(user.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (user.isLocked) return <Tag tone="warning">Đang khóa</Tag>;
  return <Tag tone="success">Hoạt động</Tag>;
}

export default function UsersClient({
  rows,
  total,
  pageNumber,
  currentUserId,
  deletedOnly,
  query,
  queryString,
}: {
  rows: AdminUserResponseDto[];
  total: number | null;
  pageNumber: number;
  currentUserId: string;
  deletedOnly: boolean;
  query: string;
  queryString: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserResponseDto | null>(null);
  const [lockTarget, setLockTarget] = useState<AdminUserResponseDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserResponseDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createRole, setCreateRole] = useState<Role>('STAFF');
  const [editRole, setEditRole] = useState<Role>('STAFF');
  const [lockReason, setLockReason] = useState('');
  const [lockedUntil, setLockedUntil] = useState('');

  const close = () => {
    if (busy) return;
    setCreateOpen(false);
    setEditUser(null);
    setLockTarget(null);
    setDeleteTarget(null);
    setError(null);
  };

  const afterWrite = () => {
    // `busy` still holds the old value inside this render, so close directly.
    setCreateOpen(false);
    setEditUser(null);
    setLockTarget(null);
    setDeleteTarget(null);
    setError(null);
    router.refresh();
  };

  const submitCreate = async () => {
    setBusy('create');
    setError(null);
    const result = await createAdminUserAction({
      fullName,
      email,
      password,
      role: createRole,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    setFullName('');
    setEmail('');
    setPassword('');
    setCreateRole('STAFF');
    afterWrite();
  };

  const submitRole = async () => {
    if (!editUser) return;
    setBusy('role');
    setError(null);
    const result = await changeUserRoleAction({ userId: editUser.id, role: editRole });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const submitLock = async () => {
    if (!lockTarget) return;
    setBusy('lock');
    setError(null);
    const result = await lockUserAction({
      userId: lockTarget.id,
      reason: lockReason,
      lockedUntil: lockedUntil ? new Date(lockedUntil).toISOString() : undefined,
    });
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    setLockReason('');
    setLockedUntil('');
    afterWrite();
  };

  const unlock = async (user: AdminUserResponseDto) => {
    setBusy(user.id);
    setError(null);
    const result = await unlockUserAction(user.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    router.refresh();
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setBusy('delete');
    setError(null);
    const result = await deactivateUserAction(deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    afterWrite();
  };

  const restore = async (user: AdminUserResponseDto) => {
    setBusy(user.id);
    setError(null);
    const result = await restoreUserAction(user.id);
    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result));
      return;
    }
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Người dùng"
        meta={`${total ?? rows.length} tài khoản`}
        lede="Tạo tài khoản Staff/Admin, đổi vai trò, khóa tạm thời và xóa mềm. Mọi thao tác được kiểm tra quyền ở gateway."
        actions={
          <Button
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
          >
            Tạo tài khoản
          </Button>
        }
      />

      {error && !createOpen && !editUser && !lockTarget && !deleteTarget && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}

      <Panel>
        <form className="toolbar" action="/admin/users" method="get">
          <div className="field">
            <label htmlFor="user-q">Tìm theo tên hoặc email</label>
            <input
              id="user-q"
              className="input"
              name="q"
              defaultValue={query}
              placeholder="Ví dụ: staff@brewlite.test"
            />
          </div>
          <label className="check" style={{ flex: 'none' }}>
            <input type="checkbox" name="deleted" value="1" defaultChecked={deletedOnly} />
            <span>
              Chỉ tài khoản đã xóa
              <small>Bật để khôi phục tài khoản đã xóa mềm.</small>
            </span>
          </label>
          <Button type="submit">Lọc</Button>
          {(query || deletedOnly) && (
            <a className="btn btn--quiet btn--sm" href="/admin/users">
              Xóa lọc
            </a>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState title={deletedOnly ? 'Không có tài khoản đã xóa' : 'Chưa có người dùng'}>
              {deletedOnly
                ? 'Không có tài khoản nào bị xóa mềm khớp bộ lọc.'
                : 'Tạo tài khoản Staff hoặc Admin đầu tiên bằng nút phía trên.'}
            </EmptyState>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack table--ledger">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Đăng nhập cuối</th>
                  <th>Ngày tạo</th>
                  <th className="cell-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const lastLogin = nullableText(user.lastLoginAt);
                  const deleted = Boolean(nullableText(user.deletedAt));
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id}>
                      <td data-label="Người dùng">
                        <span className="cell-title">{user.fullName}</span>
                        <span className="cell-meta">{user.email}</span>
                        {user.isLocked && user.lockReason && (
                          <span className="cell-meta">Lý do khóa: {user.lockReason}</span>
                        )}
                        {user.isLocked && user.lockedUntil && (
                          <span className="cell-meta">
                            Khóa đến {formatMoment(nullableText(user.lockedUntil))}
                          </span>
                        )}
                      </td>
                      <td data-label="Vai trò">
                        <Tag tone={roleTone(user.role)}>{roleLabel(user.role)}</Tag>
                      </td>
                      <td data-label="Trạng thái">
                        <UserStatus user={user} />
                      </td>
                      <td data-label="Đăng nhập cuối">
                        {lastLogin ? formatMoment(lastLogin) : 'Chưa có'}
                      </td>
                      <td data-label="Ngày tạo">{formatDay(user.createdAt)}</td>
                      <td className="cell-actions" data-label="Thao tác">
                        {deleted ? (
                          <Button
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => void restore(user)}
                          >
                            Khôi phục
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="quiet"
                              disabled={busy !== null || isSelf}
                              title={isSelf ? 'Không thể đổi vai trò của chính mình' : undefined}
                              onClick={() => {
                                setEditUser(user);
                                setEditRole(user.role as Role);
                                setError(null);
                              }}
                            >
                              Đổi vai trò
                            </Button>
                            {user.isLocked ? (
                              <Button
                                size="sm"
                                variant="quiet"
                                disabled={busy !== null}
                                onClick={() => void unlock(user)}
                              >
                                {busy === user.id ? 'Đang mở…' : 'Mở khóa'}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="quiet"
                                disabled={busy !== null || isSelf}
                                title={isSelf ? 'Không thể khóa chính mình' : undefined}
                                onClick={() => {
                                  setLockTarget(user);
                                  setError(null);
                                }}
                              >
                                Khóa
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy !== null || isSelf}
                              title={isSelf ? 'Không thể xóa chính mình' : undefined}
                              onClick={() => {
                                setDeleteTarget(user);
                                setError(null);
                              }}
                            >
                              Xóa
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
            label="tài khoản"
            query={queryString}
          />
        )}
      </Panel>

      {createOpen && (
        <Modal
          title="Tạo tài khoản"
          meta="Tài khoản có mật khẩu riêng; hãy gửi mật khẩu cho người dùng qua kênh an toàn."
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
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
                {busy === 'create' ? 'Đang tạo…' : 'Tạo tài khoản'}
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
              <label htmlFor="new-full-name">Họ tên</label>
              <input
                id="new-full-name"
                className="input"
                value={fullName}
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="new-role">Vai trò</label>
              <select
                id="new-role"
                className="input"
                value={createRole}
                onChange={(event) => setCreateRole(event.target.value as Role)}
              >
                {CREATE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
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
            <label htmlFor="new-password">Mật khẩu ban đầu</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="field-hint">Từ 8 đến 72 byte, giống quy định đăng ký của khách.</p>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal
          title={`Đổi vai trò · ${editUser.fullName}`}
          meta={editUser.email}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
              </Button>
              <Button disabled={busy !== null} onClick={() => void submitRole()}>
                {busy === 'role' ? 'Đang lưu…' : 'Lưu vai trò'}
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
            <label htmlFor="edit-role">Vai trò</label>
            <select
              id="edit-role"
              className="input"
              value={editRole}
              onChange={(event) => setEditRole(event.target.value as Role)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              Đổi vai trò sẽ đăng xuất mọi phiên hiện tại của tài khoản này.
            </p>
          </div>
        </Modal>
      )}

      {lockTarget && (
        <Modal
          title={`Khóa tài khoản · ${lockTarget.fullName}`}
          meta={lockTarget.email}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Hủy
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null || lockReason.trim().length === 0}
                onClick={() => void submitLock()}
              >
                {busy === 'lock' ? 'Đang khóa…' : 'Khóa tài khoản'}
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
              Lý do <span className="muted">(bắt buộc)</span>
            </label>
            <textarea
              id="lock-reason"
              className="input"
              rows={3}
              maxLength={255}
              value={lockReason}
              onChange={(event) => setLockReason(event.target.value)}
              placeholder="Ví dụ: nghỉ việc tạm thời"
            />
          </div>
          <div className="field">
            <label htmlFor="lock-until">Khóa đến (không bắt buộc)</label>
            <input
              id="lock-until"
              className="input"
              type="datetime-local"
              value={lockedUntil}
              onChange={(event) => setLockedUntil(event.target.value)}
            />
            <p className="field-hint">Để trống để khóa cho đến khi quản trị mở lại.</p>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={`Xóa tài khoản · ${deleteTarget.fullName}`}
          onClose={close}
          footer={
            <>
              <Button variant="quiet" disabled={busy !== null} onClick={close}>
                Giữ lại
              </Button>
              <Button
                variant="danger-fill"
                disabled={busy !== null}
                onClick={() => void submitDelete()}
              >
                {busy === 'delete' ? 'Đang xóa…' : 'Xóa mềm'}
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
            Tài khoản sẽ bị xóa mềm và đăng xuất khỏi mọi phiên. Có thể khôi phục ở bộ lọc “Chỉ tài
            khoản đã xóa”.
          </Notice>
        </Modal>
      )}
    </>
  );
}
