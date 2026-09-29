import { Locale, parseEnum, permissionsFor, Role } from '@brewlite/contracts';
import type { AdminUser as AdminUserProto } from '@brewlite/contracts/generated/brewlite/identity/admin_user_service.js';
import type { AdminUserResponseDto } from './dto/admin-user-response.dto.js';

export function toAdminUserResponseDto(proto: AdminUserProto): AdminUserResponseDto {
  const role = parseEnum(Role, proto.role);
  return {
    id: proto.id,
    email: proto.email,
    fullName: proto.fullName,
    role,
    permissions: [...permissionsFor(role)],
    hasPassword: proto.hasPassword,
    preferredLocale: parseEnum(Locale, proto.preferredLocale),
    createdAt: proto.createdAt,
    isLocked: proto.isLocked,
    lockedUntil: proto.lockedUntil ?? null,
    lockReason: proto.lockReason ?? null,
    deletedAt: proto.deletedAt ?? null,
    deletedById: proto.deletedById ?? null,
    lastLoginAt: proto.lastLoginAt ?? null,
  };
}
