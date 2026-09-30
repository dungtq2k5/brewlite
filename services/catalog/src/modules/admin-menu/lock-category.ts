import type { Prisma } from '../../../generated/prisma/client.js';

export type CategoryLockMode = 'UPDATE' | 'SHARE';

/**
 * A deleted category must never gain a product (§5.4): `Delete category` checks "no
 * live product" and `Create product` checks "the category is live" — run concurrently,
 * both pass, and a live product ends up in a deleted category. Locks the category row
 * first, as the first statement of the caller's transaction. `FOR SHARE` lets product
 * writes into one category run together and blocks only the delete; `FOR UPDATE` is
 * the delete's own lock. Returns whether a **live** row was found and locked.
 *
 * Raw SQL with physical names, shared by both `AdminCategoriesService` and
 * `AdminProductsService` — not `domain/`, which is pure rules only, no I/O
 * (conventions §2.1).
 */
export async function lockCategory(
  tx: Prisma.TransactionClient,
  id: string,
  mode: CategoryLockMode,
): Promise<boolean> {
  const rows =
    mode === 'UPDATE'
      ? await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM categories WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`
      : await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT id FROM categories WHERE id = ${id} AND deleted_at IS NULL FOR SHARE`;
  return rows.length > 0;
}
