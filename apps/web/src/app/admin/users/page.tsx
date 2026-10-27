import { adminUsersControllerList, type AdminUserResponseDto } from '@brewlite/api-client';
import { getServerUser, handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockUser } from '@/mocks/admin-data';
import { UsersClient } from './users-client';

function mapUserDto(dto: AdminUserResponseDto): MockUser {
  return {
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
}

export default async function AdminUsersPage() {
  await requireServerAuth();
  try {
    const [resActive, resDeleted, currentUser] = await Promise.all([
      adminUsersControllerList({ deleted: 'false' }),
      adminUsersControllerList({ deleted: 'true' }),
      getServerUser(),
    ]);

    const activeList = (resActive.data as unknown as { data?: AdminUserResponseDto[] })?.data ?? [];
    const deletedList = (resDeleted.data as unknown as { data?: AdminUserResponseDto[] })?.data ?? [];
    const allUsers = [...activeList, ...deletedList].map(mapUserDto);

    return (
      <UsersClient
        initialUsers={allUsers}
        currentUserId={currentUser?.id}
        currentUserEmail={currentUser?.email}
      />
    );
  } catch (err) {
    handlePageApiError(err);
  }
}