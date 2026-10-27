'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  CURRENT_ADMIN_ID,
  type MockUser,
  type UserRole,
} from '@/mocks/admin-data';
import { useLocale } from '@/i18n/locale-context';
import { lockUserSchema, unwrapNullable } from '@/lib/zod-schemas';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  deactivateUserAction,
  getUserDetailAction,
  lockUserAction,
  restoreUserAction,
  unlockUserAction,
  updateUserRoleAction,
} from './actions';

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const ROLE_PERMISSIONS_REAL: Record<UserRole, string[]> = {
  CUSTOMER: [],
  STAFF: ['stock.update', 'order.board.read', 'order.status.update', 'order.cancel.paid'],
  ADMIN: [
    'menu.manage',
    'stock.update',
    'order.board.read',
    'order.status.update',
    'order.cancel.paid',
    'order.read.all',
    'promotion.manage',
    'user.manage',
    'report.read',
  ],
};

export function UsersClient({
  initialUsers,
  currentUserId,
  currentUserEmail,
}: {
  initialUsers: MockUser[];
  currentUserId?: string;
  currentUserEmail?: string;
}) {
  const { tx, dateTime } = useLocale();
  const [users, setUsers] = useState<MockUser[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [lockFilter, setLockFilter] = useState<'ALL' | 'LOCKED' | 'UNLOCKED'>('ALL');
  const [deletedFilter, setDeletedFilter] = useState<'ACTIVE' | 'DELETED' | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt_desc' | 'createdAt_asc' | 'email_asc' | 'email_desc'>('createdAt_desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);

  const [detailUser, setDetailUser] = useState<MockUser | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [lockingUser, setLockingUser] = useState<MockUser | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [lockedUntil, setLockedUntil] = useState('');
  const [submittingLock, setSubmittingLock] = useState(false);
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<MockUser | null>(null);
  const [togglingDeactivate, setTogglingDeactivate] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const effectiveAdminsCount = users.filter(
    (u) => u.role === 'ADMIN' && !u.isLocked && !u.deletedAt,
  ).length;

  function getFriendlyError(code?: string): string {
    if (!code) return tx('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.');
    if (code.includes('LAST_ADMIN')) {
      return tx('Không thể hạ quyền, khóa hoặc vô hiệu hóa Quản trị viên hiệu lực cuối cùng.', 'Cannot modify or deactivate the last effective Admin.');
    }
    if (code.includes('SELF_ACTION_FORBIDDEN')) {
      return tx('Bạn không thể tự thực hiện thao tác này trên chính tài khoản của mình.', 'You cannot perform this action on your own account.');
    }
    if (code.includes('USER_NOT_FOUND')) {
      return tx('Không tìm thấy tài khoản người dùng.', 'User not found.');
    }
    return code;
  }

  function showError(msg: string) {
    setRuleError(msg);
    setTimeout(() => setRuleError(null), 5000);
  }

  function isSelf(user: MockUser): boolean {
    if (currentUserId && user.id === currentUserId) return true;
    if (currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase()) return true;
    return user.id === CURRENT_ADMIN_ID || user.email === 'admin@brewlite.local';
  }

  function isLastEffectiveAdmin(user: MockUser): boolean {
    return user.role === 'ADMIN' && !user.isLocked && !user.deletedAt && effectiveAdminsCount <= 1;
  }

  const filtered = users
    .filter((u) => {
      const matchSearch =
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchLock =
        lockFilter === 'ALL' || (lockFilter === 'LOCKED' ? u.isLocked : !u.isLocked);
      const matchDeleted =
        deletedFilter === 'ALL' ||
        (deletedFilter === 'DELETED' ? Boolean(u.deletedAt) : !u.deletedAt);
      return matchSearch && matchRole && matchLock && matchDeleted;
    })
    .sort((a, b) => {
      if (sortBy === 'email_asc') return compareStrings(a.email, b.email);
      if (sortBy === 'email_desc') return compareStrings(b.email, a.email);
      if (sortBy === 'createdAt_asc') return compareStrings(a.createdAt, b.createdAt);
      return compareStrings(b.createdAt, a.createdAt);
    });

  const pagedUsers = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleOpenDetail(user: MockUser) {
    setDetailUser(user);
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await getUserDetailAction(user.id);
      if (res.ok && res.data) {
        const dto = res.data;
        const freshUser: MockUser = {
          id: dto.id,
          email: dto.email,
          fullName: dto.fullName,
          role: dto.role,
          permissions: dto.permissions,
          preferredLocale: dto.preferredLocale,
          hasPassword: dto.hasPassword,
          isLocked: dto.isLocked,
          lockReason: unwrapNullable(dto.lockReason),
          lockedUntil: unwrapNullable(dto.lockedUntil),
          lastLoginAt: unwrapNullable(dto.lastLoginAt),
          deletedAt: unwrapNullable(dto.deletedAt),
          createdAt: dto.createdAt,
        };
        setDetailUser(freshUser);
        setUsers((prev) => prev.map((u) => (u.id === freshUser.id ? freshUser : u)));
      } else if (res.code === 'USER_NOT_FOUND') {
        setDetailError(tx('Không tìm thấy tài khoản người dùng trên hệ thống.', 'User account not found.'));
      }
    } catch {
      // Giữ bản xem trước nếu gặp lỗi mạng
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleCloseDetail() {
    setDetailUser(null);
    setLoadingDetail(false);
    setDetailError(null);
  }

  async function handleRoleChange(user: MockUser, nextRole: UserRole) {
    if (isSelf(user)) {
      showError(tx('Bạn không thể tự đổi vai trò của chính mình.', 'You cannot change your own role.'));
      return;
    }
    if (isLastEffectiveAdmin(user) && nextRole !== 'ADMIN') {
      showError(tx('Không thể hạ quyền Admin hiệu lực cuối cùng.', 'Cannot demote the last effective Admin.'));
      return;
    }
    const res = await updateUserRoleAction(user.id, nextRole);
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, role: nextRole, permissions: ROLE_PERMISSIONS_REAL[nextRole] }
            : u,
        ),
      );
      if (detailUser && detailUser.id === user.id) {
        setDetailUser((prev) =>
          prev
            ? { ...prev, role: nextRole, permissions: ROLE_PERMISSIONS_REAL[nextRole] }
            : null,
        );
      }
    } else {
      showError(getFriendlyError(res.code));
    }
  }

  function openLockModal(user: MockUser) {
    if (isSelf(user)) {
      showError(tx('Bạn không thể tự khóa tài khoản của chính mình.', 'You cannot lock your own account.'));
      return;
    }
    if (isLastEffectiveAdmin(user)) {
      showError(tx('Không thể khóa Admin hiệu lực cuối cùng.', 'Cannot lock the last effective Admin.'));
      return;
    }
    setLockingUser(user);
    setLockReason('');
    setLockedUntil('');
  }

  async function handleConfirmLock(e: FormEvent) {
    e.preventDefault();
    if (!lockingUser || submittingLock) return;
    const untilIso = lockedUntil ? new Date(lockedUntil).toISOString() : undefined;
    const parsed = lockUserSchema.safeParse({
      reason: lockReason,
      lockedUntil: untilIso,
    });
    if (!parsed.success) {
      showError(parsed.error.issues[0]?.message ?? tx('Lý do khóa không hợp lệ.', 'Invalid lock reason.'));
      return;
    }

    setSubmittingLock(true);
    try {
      const res = await lockUserAction(lockingUser.id, parsed.data);
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === lockingUser.id
              ? {
                  ...u,
                  isLocked: true,
                  lockReason: parsed.data.reason,
                  lockedUntil: untilIso ?? null,
                }
              : u,
          ),
        );
        if (detailUser && detailUser.id === lockingUser.id) {
          setDetailUser((prev) =>
            prev
              ? {
                  ...prev,
                  isLocked: true,
                  lockReason: parsed.data.reason,
                  lockedUntil: untilIso ?? null,
                }
              : null,
          );
        }
        setLockingUser(null);
      } else {
        showError(getFriendlyError(res.code));
      }
    } finally {
      setSubmittingLock(false);
    }
  }

  async function handleUnlock(user: MockUser) {
    const res = await unlockUserAction(user.id);
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isLocked: false, lockReason: null, lockedUntil: null } : u,
        ),
      );
      if (detailUser && detailUser.id === user.id) {
        setDetailUser((prev) =>
          prev
            ? { ...prev, isLocked: false, lockReason: null, lockedUntil: null }
            : null,
        );
      }
    } else {
      showError(getFriendlyError(res.code));
    }
  }

  function handlePromptDeactivate(user: MockUser) {
    if (isSelf(user)) {
      showError(tx('Bạn không thể tự vô hiệu hóa tài khoản của chính mình.', 'You cannot deactivate your own account.'));
      return;
    }
    if (!user.deletedAt && isLastEffectiveAdmin(user)) {
      showError(tx('Không thể vô hiệu hóa Admin hiệu lực cuối cùng.', 'Cannot deactivate the last effective Admin.'));
      return;
    }
    setConfirmDeactivateUser(user);
  }

  async function handleConfirmToggleDeactivate() {
    if (!confirmDeactivateUser || togglingDeactivate) return;
    setTogglingDeactivate(true);
    const isRestoring = Boolean(confirmDeactivateUser.deletedAt);
    try {
      const res = isRestoring
        ? await restoreUserAction(confirmDeactivateUser.id)
        : await deactivateUserAction(confirmDeactivateUser.id);
      if (res.ok) {
        const updatedDeletedAt = isRestoring ? null : new Date().toISOString();
        setUsers((prev) =>
          prev.map((u) =>
            u.id === confirmDeactivateUser.id
              ? { ...u, deletedAt: updatedDeletedAt }
              : u,
          ),
        );
        if (detailUser && detailUser.id === confirmDeactivateUser.id) {
          setDetailUser((prev) =>
            prev ? { ...prev, deletedAt: updatedDeletedAt } : null,
          );
        }
        setConfirmDeactivateUser(null);
      } else {
        showError(getFriendlyError(res.code));
      }
    } finally {
      setTogglingDeactivate(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Ô tìm kiếm */}
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-[#9B7B60]">
          🔍
        </span>
        <input
          type="text"
          className="input input-lg w-full pl-14 pr-12 rounded-full bg-[#FCF9F2] border-[1.5px] border-[#9B7B60] text-sm text-[#4E311E] placeholder:text-[#9B7B60]"
          placeholder={tx(
            'Tìm kiếm người dùng theo tên hoặc email...',
            'Search users by name or email...',
          )}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {search && (
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8C6A50] hover:text-[#4E311E]"
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Thanh công cụ số lượng & nút bộ lọc icon giống Promotions */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-[#6E4F3A]">
          {tx('Hiển thị', 'Showing')} <strong>{filtered.length}</strong>{' '}
          {tx('người dùng', 'users')}
        </span>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#6E4F3A] hover:text-[#4E311E] transition-colors"
        >
          <span>{tx('Bộ lọc', 'Filters')}</span>
          <span className="text-lg leading-none">☰</span>
        </button>
      </div>

      {showFilters && (
        <div className="rounded-3xl bg-[#FCF9F2] border border-[#B59478] p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'ALL' | UserRole);
              setPage(1);
            }}
          >
            <option value="ALL">{tx('Tất cả vai trò', 'All roles')}</option>
            <option value="ADMIN">ADMIN</option>
            <option value="STAFF">STAFF</option>
            <option value="CUSTOMER">CUSTOMER</option>
          </select>

          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={lockFilter}
            onChange={(e) => {
              setLockFilter(e.target.value as 'ALL' | 'LOCKED' | 'UNLOCKED');
              setPage(1);
            }}
          >
            <option value="ALL">{tx('Trạng thái khóa: Tất cả', 'Lock: All')}</option>
            <option value="LOCKED">{tx('Đang bị khóa', 'Locked only')}</option>
            <option value="UNLOCKED">{tx('Không khóa', 'Unlocked only')}</option>
          </select>

          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={deletedFilter}
            onChange={(e) => {
              setDeletedFilter(e.target.value as 'ACTIVE' | 'DELETED' | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">{tx('Tất cả tài khoản', 'All accounts')}</option>
            <option value="ACTIVE">{tx('Đang hoạt động', 'Active only')}</option>
            <option value="DELETED">{tx('Đã vô hiệu hóa', 'Deactivated only')}</option>
          </select>

          <select
            className="select select-bordered select-sm rounded-full bg-[#F3ECE1] border-[#9B7B60]"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as typeof sortBy);
              setPage(1);
            }}
          >
            <option value="createdAt_desc">{tx('Mới tạo nhất', 'Newest first')}</option>
            <option value="createdAt_asc">{tx('Cũ nhất', 'Oldest first')}</option>
            <option value="email_asc">Email A → Z</option>
            <option value="email_desc">Email Z → A</option>
          </select>
        </div>
      )}

      {ruleError && (
        <div className="rounded-2xl bg-[#B83B2A] text-white px-4 py-2.5 text-xs font-bold">
          ⚠️ {ruleError}
        </div>
      )}

      {/* Danh sách người dùng */}
      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-3.5 sm:p-6 space-y-3">
        {pagedUsers.length === 0 ? (
          <EmptyState
            titleVi="Không tìm thấy người dùng phù hợp"
            titleEn="No matching users found"
          />
        ) : (
          pagedUsers.map((user) => {
            const self = isSelf(user);
            return (
              <div
                key={user.id}
                className={`rounded-[24px] bg-[#F3ECE1] border border-[#9B7B60] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  user.deletedAt ? 'opacity-65' : ''
                }`}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  onClick={() => void handleOpenDetail(user)}
                >
                  <div className="w-11 h-11 rounded-full bg-[#FCF9F2] border border-[#9B7B60] flex items-center justify-center text-xl shrink-0">
                    👤
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-extrabold text-[#4E311E] flex flex-wrap items-center gap-1.5">
                      <span className="truncate">{user.fullName}</span>
                      {self && (
                        <span className="px-2 py-0.2 rounded-full bg-[#4E311E] text-[#F5EFE6] text-[10px] font-bold">
                          {tx('Bạn', 'You')}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-[#4E311E] text-white text-[10px] font-bold">
                        {user.role}
                      </span>
                      {user.deletedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#B83B2A] text-white text-[10px] font-bold">
                          {tx('Đã vô hiệu', 'Deactivated')}
                        </span>
                      ) : user.isLocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#A85D00] text-white text-[10px] font-bold">
                          {tx('Đang khóa', 'Locked')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#1F5C32] text-white text-[10px] font-bold">
                          {tx('Hoạt động', 'Active')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#6E4F3A] truncate mt-0.5">
                      {user.email}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C9B29B]">
                  <select
                    className="select select-xs rounded-full bg-[#FCF9F2] border-[#9B7B60] font-bold text-[#4E311E]"
                    value={user.role}
                    disabled={self}
                    onChange={(e) => void handleRoleChange(user, e.target.value as UserRole)}
                  >
                    <option value="CUSTOMER">CUSTOMER</option>
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => void handleOpenDetail(user)}
                    className="px-3 py-1 rounded-full border border-[#9B7B60] bg-[#FCF9F2] text-[#4E311E] text-xs font-bold hover:bg-[#4E311E] hover:text-white transition-colors"
                  >
                    {tx('Chi tiết', 'Details')}
                  </button>

                  {user.isLocked ? (
                    <button
                      type="button"
                      onClick={() => void handleUnlock(user)}
                      className="px-3 py-1 rounded-full bg-[#1F5C32] text-white text-xs font-bold hover:bg-[#154223] transition-colors"
                    >
                      {tx('Mở khóa', 'Unlock')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={self}
                      onClick={() => openLockModal(user)}
                      className="px-3 py-1 rounded-full bg-[#A85D00] text-white text-xs font-bold hover:bg-[#854900] disabled:opacity-30 transition-colors"
                    >
                      {tx('Khóa', 'Lock')}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={self}
                    onClick={() => handlePromptDeactivate(user)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors disabled:opacity-30 ${
                      user.deletedAt
                        ? 'bg-[#2B5B6C] hover:bg-[#1E414D] text-white'
                        : 'bg-[#B83B2A] hover:bg-[#8F2D1F] text-white'
                    }`}
                  >
                    {user.deletedAt ? tx('Khôi phục', 'Restore') : tx('Vô hiệu hóa', 'Deactivate')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        onPageChange={setPage}
      />

      {/* Modal Khóa Người dùng */}
      {lockingUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px]">
            <h3 className="font-bold text-lg text-[#B83B2A]">
              {tx('Khóa tài khoản:', 'Lock Account:')} {lockingUser.fullName}
            </h3>
            <form onSubmit={handleConfirmLock} className="space-y-4 mt-3">
              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">
                  {tx('Lý do khóa (Bắt buộc *)', 'Lock Reason (Required *)')}
                </legend>
                <textarea
                  className="textarea textarea-bordered w-full bg-[#F3ECE1] border-[#9B7B60]"
                  rows={3}
                  required
                  placeholder={tx('Nhập lý do khóa tài khoản...', 'Enter reason for locking account...')}
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                />
              </fieldset>

              <fieldset className="fieldset">
                <legend className="fieldset-legend font-bold">
                  {tx('Khóa đến thời điểm (Tùy chọn, để trống nếu khóa vĩnh viễn)', 'Locked Until (Optional, leave empty for permanent)')}
                </legend>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full bg-[#F3ECE1] border-[#9B7B60]"
                  value={lockedUntil}
                  onChange={(e) => setLockedUntil(e.target.value)}
                />
              </fieldset>

              <div className="modal-action">
                <button
                  type="button"
                  disabled={submittingLock}
                  className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold"
                  onClick={() => setLockingUser(null)}
                >
                  {tx('Đóng', 'Close')}
                </button>
                <button
                  type="submit"
                  disabled={submittingLock}
                  className="px-5 py-2 rounded-full bg-[#B83B2A] text-white text-xs font-bold hover:bg-[#8F2D1F] disabled:opacity-50"
                >
                  {submittingLock ? '...' : tx('Xác nhận Khóa', 'Confirm Lock')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Vô hiệu hóa / Khôi phục */}
      {confirmDeactivateUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md">
            <h3 className="font-bold text-lg text-[#4E311E] mb-2">
              {confirmDeactivateUser.deletedAt
                ? tx('Xác nhận khôi phục tài khoản?', 'Confirm restore account?')
                : tx('Xác nhận vô hiệu hóa tài khoản?', 'Confirm deactivate account?')}
            </h3>
            <p className="text-xs text-[#6E4F3A]">
              {confirmDeactivateUser.deletedAt
                ? tx(
                    `Tài khoản "${confirmDeactivateUser.fullName}" (${confirmDeactivateUser.email}) sẽ được khôi phục hoạt động bình thường.`,
                    `Account "${confirmDeactivateUser.fullName}" (${confirmDeactivateUser.email}) will be restored to active.`,
                  )
                : tx(
                    `Tài khoản "${confirmDeactivateUser.fullName}" (${confirmDeactivateUser.email}) sẽ bị vô hiệu hóa và không thể đăng nhập cho đến khi được khôi phục.`,
                    `Account "${confirmDeactivateUser.fullName}" (${confirmDeactivateUser.email}) will be deactivated and cannot login until restored.`,
                  )}
            </p>
            <div className="modal-action">
              <button
                type="button"
                disabled={togglingDeactivate}
                className="px-4 py-2 rounded-full border border-[#9B7B60] text-xs font-bold"
                onClick={() => setConfirmDeactivateUser(null)}
              >
                {tx('Hủy', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={togglingDeactivate}
                onClick={handleConfirmToggleDeactivate}
                className={`px-5 py-2 rounded-full text-white text-xs font-bold disabled:opacity-50 ${
                  confirmDeactivateUser.deletedAt ? 'bg-[#2B5B6C]' : 'bg-[#B83B2A]'
                }`}
              >
                {togglingDeactivate
                  ? '...'
                  : confirmDeactivateUser.deletedAt
                    ? tx('Xác nhận Khôi phục', 'Confirm Restore')
                    : tx('Xác nhận Vô hiệu', 'Confirm Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chi tiết Người dùng - Tối giản & Trực quan */}
      {detailUser && (
        <div className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box bg-[#FCF9F2] border border-[#9B7B60] rounded-[28px] max-w-md p-6 space-y-4">
            {/* Header: Nhận diện người dùng */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-[#C9B29B]">
              <div className="w-12 h-12 rounded-full bg-[#4E311E] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {detailUser.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg text-[#4E311E] truncate">
                  {detailUser.fullName}
                </h3>
                <p className="text-xs text-[#8C6A50] font-mono truncate">
                  {detailUser.email}
                </p>
                {loadingDetail && (
                  <span className="text-[10px] text-[#A85D00] animate-pulse block">
                    {tx('Đang đồng bộ...', 'Syncing...')}
                  </span>
                )}
              </div>
            </div>

            {/* Thông báo lỗi nếu có */}
            {detailError && (
              <div className="rounded-2xl bg-[#B83B2A] text-white p-3 text-xs font-bold">
                ⚠️ {detailError}
              </div>
            )}

            {/* Khung thông tin quản lý thiết yếu */}
            <div className="space-y-3 bg-[#F3ECE1] border border-[#C9B29B] p-4 rounded-2xl text-xs">
              {/* Vai trò */}
              <div className="flex justify-between items-center py-1 border-b border-[#C9B29B]/50">
                <span className="text-[#8C6A50] font-medium">{tx('Vai trò tài khoản', 'Account Role')}</span>
                <span className="px-3 py-0.5 rounded-full bg-[#4E311E] text-white font-bold">
                  {detailUser.role === 'ADMIN'
                    ? tx('Quản trị viên (ADMIN)', 'Admin (ADMIN)')
                    : detailUser.role === 'STAFF'
                      ? tx('Nhân viên quầy (STAFF)', 'Staff (STAFF)')
                      : tx('Khách hàng (CUSTOMER)', 'Customer (CUSTOMER)')}
                </span>
              </div>

              {/* Trạng thái hoạt động */}
              <div className="py-1 border-b border-[#C9B29B]/50">
                <div className="flex justify-between items-center">
                  <span className="text-[#8C6A50] font-medium">{tx('Trạng thái', 'Status')}</span>
                  {detailUser.deletedAt ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#B83B2A] text-white font-bold">
                      {tx('Đã vô hiệu hóa', 'Deactivated')}
                    </span>
                  ) : detailUser.isLocked ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#A85D00] text-white font-bold">
                      {tx('Đang bị khóa', 'Locked')}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#1F5C32] text-white font-bold">
                      {tx('Đang hoạt động', 'Active')}
                    </span>
                  )}
                </div>
                {detailUser.isLocked && (
                  <div className="mt-2 p-2 rounded-xl bg-[#A85D00]/15 border border-[#A85D00]/30 text-[#854900] space-y-0.5">
                    <div>
                      <strong>{tx('Lý do:', 'Reason:')}</strong>{' '}
                      {detailUser.lockReason || tx('Không có ghi chú', 'No note')}
                    </div>
                    <div>
                      <strong>{tx('Thời hạn:', 'Until:')}</strong>{' '}
                      {detailUser.lockedUntil ? dateTime(detailUser.lockedUntil) : tx('Vô thời hạn', 'Indefinite')}
                    </div>
                  </div>
                )}
              </div>

              {/* Ngày tạo tài khoản */}
              <div className="flex justify-between items-center py-1 border-b border-[#C9B29B]/50">
                <span className="text-[#8C6A50] font-medium">{tx('Ngày tham gia', 'Joined Date')}</span>
                <span className="font-semibold text-[#4E311E]">{dateTime(detailUser.createdAt)}</span>
              </div>

              {/* Đăng nhập gần nhất */}
              <div className="flex justify-between items-center py-1">
                <span className="text-[#8C6A50] font-medium">{tx('Đăng nhập gần nhất', 'Last Login')}</span>
                <span className="font-semibold text-[#4E311E]">
                  {detailUser.lastLoginAt ? dateTime(detailUser.lastLoginAt) : tx('Chưa từng đăng nhập', 'Never logged in')}
                </span>
              </div>
            </div>

            {/* Modal action */}
            <div className="modal-action pt-1">
              <button
                type="button"
                className="w-full py-2.5 rounded-full bg-[#4E311E] text-white text-xs font-bold hover:bg-[#3D2517] transition-colors"
                onClick={handleCloseDetail}
              >
                {tx('Đóng', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}