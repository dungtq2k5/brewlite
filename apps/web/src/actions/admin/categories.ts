'use server';

import {
  adminCategoriesControllerCreate,
  adminCategoriesControllerDelete,
  adminCategoriesControllerRestore,
  adminCategoriesControllerUpdate,
  type AdminCategoryResponseDto,
} from '@brewlite/api-client';
import type { ActionResult } from '@/lib/action-result';
import { run, runVoid } from './run';

export interface CategoryInput {
  name: { en: string; vi: string };
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCategory(
  input: CategoryInput,
): Promise<ActionResult<AdminCategoryResponseDto>> {
  return run(() => adminCategoriesControllerCreate(input));
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
): Promise<ActionResult<AdminCategoryResponseDto>> {
  return run(() => adminCategoriesControllerUpdate(id, input));
}

/** `CATEGORY_IN_USE` while live products remain — the screen words it with its own counts. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  return runVoid(() => adminCategoriesControllerDelete(id));
}

/** `CATEGORY_NAME_TAKEN` when a live category took the name meanwhile. */
export async function restoreCategory(id: string): Promise<ActionResult<AdminCategoryResponseDto>> {
  return run(() => adminCategoriesControllerRestore(id));
}

/**
 * A drag's result: each changed row's new `sortOrder`, written in parallel. Any failure fails the
 * whole action — the screen then puts the list back as the server has it.
 */
export async function reorderCategories(
  changes: readonly { id: string; sortOrder: number }[],
): Promise<ActionResult> {
  const results = await Promise.all(
    changes.map(({ id, sortOrder }) =>
      run(() => adminCategoriesControllerUpdate(id, { sortOrder })),
    ),
  );
  const failed = results.find((r) => !r.ok);
  return failed && !failed.ok ? failed : { ok: true, data: undefined };
}
