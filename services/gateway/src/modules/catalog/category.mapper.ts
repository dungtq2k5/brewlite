import type { Category as CategoryProto } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';

export function toCategoryResponseDto(proto: CategoryProto): CategoryResponseDto {
  return {
    id: proto.id,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
  };
}
