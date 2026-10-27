import { promotionsControllerList, type PromotionResponseDto } from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockPromotion } from '@/mocks/admin-data';
import { PromotionsClient } from './promotions-client';

function mapPromo(dto: PromotionResponseDto, isDeleted = false): MockPromotion {
  const rawDeletedAt = (dto as unknown as { deletedAt?: string | string[] | null }).deletedAt;
  return {
    id: dto.id,
    code: dto.code,
    description: unwrapNullable(dto.description),
    discountType: dto.discountType,
    discountValue: dto.discountValue,
    maxDiscountVnd: dto.maxDiscountVnd,
    minSubtotalVnd: dto.minSubtotalVnd,
    startsAt: dto.startsAt,
    endsAt: dto.endsAt,
    maxUses: unwrapNullable(dto.maxUses),
    perUserLimit: unwrapNullable(dto.perUserLimit),
    usedCount: dto.usedCount,
    isActive: dto.isActive,
    createdAt: dto.createdAt,
    deletedAt: isDeleted ? (unwrapNullable(rawDeletedAt) || new Date().toISOString()) : null,
  };
}

export default async function AdminPromotionsPage() {
  await requireServerAuth();
  try {
    const [resActive, resDeleted] = await Promise.all([
      promotionsControllerList({ deleted: 'false', pageSize: 100 }),
      promotionsControllerList({ deleted: 'true', pageSize: 100 }),
    ]);

    const activeList = ((resActive.data as unknown as { data?: PromotionResponseDto[] })?.data ?? []).map((d) =>
      mapPromo(d, false),
    );
    const deletedList = ((resDeleted.data as unknown as { data?: PromotionResponseDto[] })?.data ?? []).map((d) =>
      mapPromo(d, true),
    );

    const promotions = [...activeList, ...deletedList];

    return <PromotionsClient initialPromotions={promotions} />;
  } catch (err) {
    handlePageApiError(err);
  }
}