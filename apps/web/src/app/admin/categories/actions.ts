'use server';

import {
  adminCategoriesControllerCreate,
  adminCategoriesControllerDelete,
  adminCategoriesControllerRestore,
  adminCategoriesControllerUpdate,
} from '@brewlite/api-client';
import { executeServerAction, type ActionResult } from '@/lib/api-server';
import type { MockCategory } from '@/mocks/admin-data';

export interface ShiftedCategoryResult {
  id: string;
  sortOrder: number;
}

export async function createCategoryWithShiftAction(
  newCat: {
    name: { vi: string; en: string };
    sortOrder: number;
    isActive: boolean;
  },
  existingActiveCats: { id: string; sortOrder: number }[],
): Promise<ActionResult<{ created: MockCategory; shifted: ShiftedCategoryResult[] }>> {
  const cleanName = {
    vi: newCat.name.vi.trim(),
    en: newCat.name.en.trim(),
  };
  const cleanIsActive = newCat.isActive ?? true;

  // Sắp xếp danh mục hiện có theo thứ tự tăng dần
  const sorted = [...existingActiveCats].sort((a, b) => a.sortOrder - b.sortOrder);
  const maxPos = sorted.length + 1;
  const targetPos = Math.max(1, Math.min(maxPos, Number(newCat.sortOrder) || maxPos));

  // 1. Tạo danh mục mới tại vị trí targetPos
  const createRes = await executeServerAction<MockCategory>(
    () =>
      adminCategoriesControllerCreate({
        name: cleanName,
        sortOrder: targetPos,
        isActive: cleanIsActive,
      }),
    '/admin/categories',
  );

  if (!createRes.ok || !createRes.data) {
    return {
      ok: false,
      code: createRes.code,
      details: createRes.details,
      status: createRes.status,
    };
  }

  const createdCategory = createRes.data;

  // 2. Xác định các danh mục cũ cần dịch xuống một vị trí (vị trí >= targetPos)
  // Duyệt từ vị trí lớn nhất xuống targetPos để tránh trùng lặp trong quá trình cập nhật
  const shifted: ShiftedCategoryResult[] = [];
  const toUpdate: ShiftedCategoryResult[] = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const currentRank = i + 1; // Vị trí thứ tự 1-based
    if (currentRank >= targetPos) {
      const newSortOrder = currentRank + 1;
      toUpdate.push({ id: sorted[i].id, sortOrder: newSortOrder });
      shifted.push({ id: sorted[i].id, sortOrder: newSortOrder });
    }
  }

  // Cập nhật từng danh mục liên quan theo thứ tự giảm dần
  for (const item of toUpdate) {
    try {
      await adminCategoriesControllerUpdate(item.id, {
        sortOrder: item.sortOrder,
      });
    } catch (err) {
      console.error(`Không thể cập nhật danh mục ${item.id} sang vị trí ${item.sortOrder}:`, err);
    }
  }

  return {
    ok: true,
    data: {
      created: createdCategory,
      shifted,
    },
    status: createRes.status,
  };
}

export async function saveCategoryAction(
  payload: MockCategory,
  isNew = false,
): Promise<ActionResult<MockCategory>> {
  const cleanName = {
    vi: payload.name.vi.trim(),
    en: payload.name.en.trim(),
  };
  const cleanSortOrder = Math.max(1, Math.min(32767, Number(payload.sortOrder) || 1));
  const cleanIsActive = payload.isActive ?? true;

  if (isNew) {
    return executeServerAction(
      () =>
        adminCategoriesControllerCreate({
          name: cleanName,
          sortOrder: cleanSortOrder,
          isActive: cleanIsActive,
        }),
      '/admin/categories',
    );
  }
  return executeServerAction(
    () =>
      adminCategoriesControllerUpdate(payload.id, {
        name: cleanName,
        sortOrder: cleanSortOrder,
        isActive: cleanIsActive,
      }),
    '/admin/categories',
  );
}

export async function toggleCategoryDeleteAction(
  id: string,
  shouldRestore: boolean,
): Promise<ActionResult<{ id: string; deletedAt: string | null }>> {
  const res = await executeServerAction(
    () =>
      shouldRestore
        ? adminCategoriesControllerRestore(id)
        : adminCategoriesControllerDelete(id),
    '/admin/categories',
  );
  return {
    ok: res.ok,
    code: res.code,
    details: res.details,
    data: { id, deletedAt: shouldRestore ? null : new Date().toISOString() },
  };
}