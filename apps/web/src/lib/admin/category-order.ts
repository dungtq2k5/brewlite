/** Categories are numbered 10, 20, 30… so a later insert has room and a reorder rewrites few rows. */
export const SORT_STEP = 10;

export interface Sortable {
  id: string;
  sortOrder: number;
}

/**
 * After a drag: the new order as ids, and only the rows whose `sortOrder` actually changes when the
 * list is renumbered 10, 20, 30… — the PATCHes to send.
 */
export function renumber(before: readonly Sortable[], orderedIds: readonly string[]) {
  const current = new Map(before.map((c) => [c.id, c.sortOrder]));
  const changes: { id: string; sortOrder: number }[] = [];
  orderedIds.forEach((id, index) => {
    const sortOrder = (index + 1) * SORT_STEP;
    if (current.get(id) !== sortOrder) changes.push({ id, sortOrder });
  });
  return changes;
}

/** `ids` with `moved` taken out and put at `toIndex` (the keyboard and pointer both end here). */
export function moveId(ids: readonly string[], moved: string, toIndex: number): string[] {
  const rest = ids.filter((id) => id !== moved);
  const at = Math.max(0, Math.min(toIndex, rest.length));
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}
