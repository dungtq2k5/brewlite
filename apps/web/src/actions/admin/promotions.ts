'use server';

import {
  promotionsControllerCreate,
  promotionsControllerDelete,
  promotionsControllerRestore,
  promotionsControllerUpdate,
  type CreatePromotionDto,
  type PromotionResponseDto,
  type UpdatePromotionDto,
} from '@brewlite/api-client';
import type { ActionResult } from '@/lib/action-result';
import { run, runVoid } from './run';

export async function createPromotion(
  body: CreatePromotionDto,
): Promise<ActionResult<PromotionResponseDto>> {
  return run(() => promotionsControllerCreate(body));
}

/** `PROMO_MAX_USES_BELOW_USED` carries `details.usedCount`. */
export async function updatePromotion(
  id: string,
  body: UpdatePromotionDto,
): Promise<ActionResult<PromotionResponseDto>> {
  return run(() => promotionsControllerUpdate(id, body));
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  return runVoid(() => promotionsControllerDelete(id));
}

export async function restorePromotion(id: string): Promise<ActionResult<PromotionResponseDto>> {
  return run(() => promotionsControllerRestore(id));
}
