'use server';

import {
  adminUsersControllerChangeRole,
  adminUsersControllerDeactivate,
  adminUsersControllerLock,
  adminUsersControllerRestore,
  adminUsersControllerUnlock,
  type AdminUserResponseDto,
  type ChangeRoleDto,
  type LockUserDto,
} from '@brewlite/api-client';
import type { ActionResult } from '@/lib/action-result';
import { run, runVoid } from './run';

type User = AdminUserResponseDto;

/** `SELF_ACTION_FORBIDDEN`, `LAST_ADMIN` and `INVALID_STATE` (`details.status`) come back as codes. */
export async function changeRole(id: string, body: ChangeRoleDto): Promise<ActionResult<User>> {
  return run(() => adminUsersControllerChangeRole(id, body));
}

export async function lockUser(id: string, body: LockUserDto): Promise<ActionResult<User>> {
  return run(() => adminUsersControllerLock(id, body));
}

export async function unlockUser(id: string): Promise<ActionResult<User>> {
  return run(() => adminUsersControllerUnlock(id));
}

export async function deactivateUser(id: string): Promise<ActionResult> {
  return runVoid(() => adminUsersControllerDeactivate(id));
}

export async function restoreUser(id: string): Promise<ActionResult<User>> {
  return run(() => adminUsersControllerRestore(id));
}
