/**
 * *"No admin that is neither locked nor deactivated"* — the predicate `assertNotLastAdmin`
 * counts over the already-`role = 'ADMIN' AND deleted_at IS NULL`-filtered row lock. An
 * expired, not-yet-lifted lock counts as unlocked: it will lift at the next sign-in.
 */
export function isEffectiveAdmin(
  admin: { isLocked: boolean; lockedUntil: Date | null },
  now: Date,
): boolean {
  return !admin.isLocked || (admin.lockedUntil !== null && admin.lockedUntil <= now);
}
