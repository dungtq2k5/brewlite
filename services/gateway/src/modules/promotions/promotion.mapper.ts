import type { Promotion } from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { PromotionResponseDto } from './dto/promotion.dto.js';

export function toPromotionResponseDto(promotion: Promotion): PromotionResponseDto {
  return {
    id: promotion.id,
    code: promotion.code,
    description: promotion.description ?? null,
    discountType: promotion.discountType as PromotionResponseDto['discountType'],
    discountValue: promotion.discountValue,
    maxDiscountVnd: promotion.maxDiscountVnd ?? null,
    minSubtotalVnd: promotion.minSubtotalVnd,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    maxUses: promotion.maxUses ?? null,
    usedCount: promotion.usedCount,
    perUserLimit: promotion.perUserLimit ?? null,
    isActive: promotion.isActive,
    createdAt: promotion.createdAt,
  };
}
