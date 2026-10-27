'use server';

import {
  promotionsControllerCreate,
  promotionsControllerDelete,
  promotionsControllerRestore,
  promotionsControllerUpdate,
} from '@brewlite/api-client';
import { executeServerAction } from '@/lib/api-server';
import type { MockPromotion } from '@/mocks/admin-data';

export async function savePromotionAction(promo: MockPromotion, isEdit = false) {
  const cleanDescription = promo.description?.trim() || undefined;

  let endsAtIso: string | undefined = undefined;
  if (promo.endsAt) {
    try {
      endsAtIso = new Date(promo.endsAt).toISOString();
    } catch {
      endsAtIso = promo.endsAt;
    }
  }

  if (isEdit) {
    return executeServerAction(
      () =>
        promotionsControllerUpdate(promo.id, {
          description: cleanDescription,
          clearDescription: !cleanDescription,
          endsAt: endsAtIso,
          maxUses: promo.maxUses != null && Number(promo.maxUses) > 0 ? Number(promo.maxUses) : undefined,
          perUserLimit:
            promo.perUserLimit != null && Number(promo.perUserLimit) > 0
              ? Number(promo.perUserLimit)
              : undefined,
          isActive: promo.isActive,
        }),
      '/admin/promotions',
    );
  }

  let startsAtIso = promo.startsAt;
  try {
    startsAtIso = new Date(promo.startsAt).toISOString();
  } catch {
    startsAtIso = promo.startsAt;
  }

  const isPercent = promo.discountType === 'PERCENT';

  return executeServerAction(
    () =>
      promotionsControllerCreate({
        code: promo.code.trim().toUpperCase(),
        description: cleanDescription,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue),
        maxDiscountVnd:
          isPercent && promo.maxDiscountVnd && Number(promo.maxDiscountVnd) > 0
            ? Number(promo.maxDiscountVnd)
            : undefined,
        minSubtotalVnd:
          promo.minSubtotalVnd != null && Number(promo.minSubtotalVnd) >= 0
            ? Number(promo.minSubtotalVnd)
            : 0,
        startsAt: startsAtIso,
        endsAt: endsAtIso ?? promo.endsAt,
        maxUses: promo.maxUses != null && Number(promo.maxUses) > 0 ? Number(promo.maxUses) : undefined,
        perUserLimit:
          promo.perUserLimit != null && Number(promo.perUserLimit) > 0
            ? Number(promo.perUserLimit)
            : undefined,
        isActive: promo.isActive ?? true,
      }),
    '/admin/promotions',
  );
}

export async function togglePromotionDeleteAction(id: string, shouldRestore: boolean) {
  return executeServerAction(
    () =>
      shouldRestore ? promotionsControllerRestore(id) : promotionsControllerDelete(id),
    '/admin/promotions',
  );
}

export async function togglePromotionActiveAction(id: string, isActive: boolean) {
  return executeServerAction(
    () =>
      promotionsControllerUpdate(id, {
        isActive,
      }),
    '/admin/promotions',
  );
}