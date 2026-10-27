'use server';

import {
  adminUsersControllerChangeRole,
  adminUsersControllerDeactivate,
  adminUsersControllerGet,
  adminUsersControllerLock,
  adminUsersControllerRestore,
  adminUsersControllerUnlock,
  type AdminUserResponseDto,
  type LockUserDto,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';
import type { UserRole } from '@/mocks/admin-data';

export async function getUserDetailAction(userId: string) {
  return executeServerAction<AdminUserResponseDto>(
    () => adminUsersControllerGet(userId),
  );
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  return executeServerAction(
    () => adminUsersControllerChangeRole(userId, { role }),
    '/admin/users',
  );
}

export async function lockUserAction(userId: string, dto: LockUserDto) {
  return executeServerAction(() => adminUsersControllerLock(userId, dto), '/admin/users');
}

export async function unlockUserAction(userId: string) {
  return executeServerAction(() => adminUsersControllerUnlock(userId), '/admin/users');
}

export async function deactivateUserAction(userId: string) {
  return executeServerAction(() => adminUsersControllerDeactivate(userId), '/admin/users');
}

export async function restoreUserAction(userId: string) {
  return executeServerAction(() => adminUsersControllerRestore(userId), '/admin/users');
}