import type { Me } from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const ME_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  passwordHash: true,
  preferredLocale: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type MeRow = Prisma.UserGetPayload<{ select: typeof ME_SELECT }>;

export function toProtoMe(row: MeRow): Me {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    hasPassword: row.passwordHash !== null,
    preferredLocale: row.preferredLocale,
    createdAt: row.createdAt.toISOString(),
  };
}
