import type { AdminCategory as AdminCategoryProto } from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { AdminCategoryResponseDto } from './dto/admin-category.dto.js';

export function toAdminCategoryResponseDto(proto: AdminCategoryProto): AdminCategoryResponseDto {
  return {
    id: proto.id,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    sortOrder: proto.sortOrder,
    isActive: proto.isActive,
    deletedAt: proto.deletedAt ?? null,
    deletedById: proto.deletedById ?? null,
    createdAt: proto.createdAt,
  };
}
