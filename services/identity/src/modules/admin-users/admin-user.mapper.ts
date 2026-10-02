import type { AdminUser } from '@brewlite/contracts/generated/brewlite/identity/admin_user_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  passwordHash: true,
  preferredLocale: true,
  createdAt: true,
  isLocked: true,
  lockedUntil: true,
  lockReason: true,
  deletedAt: true,
  deletedById: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>;

export function toProtoAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    hasPassword: row.passwordHash !== null,
    preferredLocale: row.preferredLocale,
    createdAt: row.createdAt.toISOString(),
    isLocked: row.isLocked,
    lockedUntil: row.lockedUntil?.toISOString(),
    lockReason: row.lockReason ?? undefined,
    deletedAt: row.deletedAt?.toISOString(),
    deletedById: row.deletedById ?? undefined,
    lastLoginAt: row.lastLoginAt?.toISOString(),
  };
}
