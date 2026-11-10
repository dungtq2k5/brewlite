import 'server-only';
import {
  adminProductsControllerList,
  type AdminProductListItemResponseDto,
} from '@brewlite/api-client';
import { MAX_PAGE_SIZE } from '@brewlite/contracts';
import '@/lib/api';

/**
 * Every live product, read page by page (≤ 200 products: two pages of 100). The API has no per-
 * category count, so the categories page counts them itself (D05 §11.4).
 */
export async function allLiveProducts(): Promise<AdminProductListItemResponseDto[]> {
  const all: AdminProductListItemResponseDto[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await adminProductsControllerList({ page, pageSize: MAX_PAGE_SIZE });
    const rows = res.status === 200 ? (res.data.data ?? []) : [];
    all.push(...rows);
    const total = res.status === 200 ? (res.data.meta?.total ?? 0) : 0;
    if (all.length >= total || rows.length === 0) break;
  }
  return all;
}

/** `categoryId` → how many live products it holds. */
export function countByCategory(
  products: readonly AdminProductListItemResponseDto[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  return counts;
}
