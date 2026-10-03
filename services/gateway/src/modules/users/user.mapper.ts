import { Locale, parseEnum, permissionsFor, Role } from '@brewlite/contracts';
import type { Me as MeProto } from '@brewlite/contracts/generated/brewlite/identity/user_service.js';
import type { MeResponseDto } from './dto/me-response.dto.js';

export function toMeResponseDto(proto: MeProto): MeResponseDto {
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
  };
}
