import type {
  StaffProduct as StaffProductProto,
  StaffTopping as StaffToppingProto,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import type { StaffProductResponseDto, StaffToppingResponseDto } from './dto/staff-response.dto.js';

export function toStaffProductResponseDto(proto: StaffProductProto): StaffProductResponseDto {
  return {
    id: proto.id,
    categoryId: proto.categoryId,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    isAvailable: proto.isAvailable,
    stockQty: proto.stockQty ?? null,
    version: proto.version,
  };
}

export function toStaffToppingResponseDto(proto: StaffToppingProto): StaffToppingResponseDto {
  return {
    id: proto.id,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    priceVnd: proto.priceVnd,
    isAvailable: proto.isAvailable,
  };
}
