import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { MeResponseDto } from '@brewlite/api-client';
import type { Permission } from '@brewlite/contracts';
import { fetchMe, isUnauthenticated } from './api-server';
import { ACCESS_COOKIE } from './auth-cookies';

export type SessionUser = MeResponseDto;

/**
 * Layout and page both call a guard on the same request. React's `cache` keeps that to
 * one `/users/me` call per render instead of one per guard.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await fetchMe();
  } catch (error) {
    if (isUnauthenticated(error)) return null;
    throw error;
  }
});

function loginUrl(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

/** Server-side guard. The gateway still checks every call; this only routes people. */
export async function requireUser(nextPath = '/'): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect(loginUrl(nextPath));
  return user;
}

export async function requireRole(
  roles: readonly SessionUser['role'][],
  nextPath: string,
): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.role)) redirect('/403');
  return user;
}

export function requireStaff(nextPath = '/staff'): Promise<SessionUser> {
  return requireRole(['STAFF', 'ADMIN'], nextPath);
}

export function requireAdmin(nextPath = '/admin'): Promise<SessionUser> {
  return requireRole(['ADMIN'], nextPath);
}

export async function requirePermission(
  permission: Permission,
  nextPath: string,
): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.permissions.includes(permission)) redirect('/403');
  return user;
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}
