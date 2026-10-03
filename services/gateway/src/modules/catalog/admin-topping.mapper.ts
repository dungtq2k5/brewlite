import type { AdminTopping as AdminToppingProto } from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { AdminToppingResponseDto } from './dto/admin-topping.dto.js';

export function toAdminToppingResponseDto(proto: AdminToppingProto): AdminToppingResponseDto {
  return {
    id: proto.id,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    priceVnd: proto.priceVnd,
    isAvailable: proto.isAvailable,
    deletedAt: proto.deletedAt ?? null,
    deletedById: proto.deletedById ?? null,
    createdAt: proto.createdAt,
  };
}
