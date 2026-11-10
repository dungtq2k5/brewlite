'use server';

import {
  adminToppingsControllerCreate,
  adminToppingsControllerDelete,
  adminToppingsControllerList,
  adminToppingsControllerRestore,
  adminToppingsControllerUpdate,
  type AdminToppingResponseDto,
} from '@brewlite/api-client';
import type { ActionResult } from '@/lib/action-result';
import { run, runVoid } from './run';

export interface ToppingInput {
  name: { en: string; vi: string };
  priceVnd: number;
}

export async function createTopping(
  input: ToppingInput,
): Promise<ActionResult<AdminToppingResponseDto>> {
  return run(() => adminToppingsControllerCreate(input));
}

export async function updateTopping(
  id: string,
  input: Partial<ToppingInput> & { isAvailable?: boolean },
): Promise<ActionResult<AdminToppingResponseDto>> {
  return run(() => adminToppingsControllerUpdate(id, input));
}

export async function deleteTopping(id: string): Promise<ActionResult> {
  return runVoid(() => adminToppingsControllerDelete(id));
}

export async function restoreTopping(id: string): Promise<ActionResult<AdminToppingResponseDto>> {
  return run(() => adminToppingsControllerRestore(id));
}

/** The live toppings now — what the product editor re-reads to name one deleted mid-edit. */
export async function liveToppings(): Promise<ActionResult<AdminToppingResponseDto[]>> {
  return run(() => adminToppingsControllerList());
}
