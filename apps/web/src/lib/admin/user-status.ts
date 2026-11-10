export type UserStatus =
  { kind: 'active' } | { kind: 'locked'; until: string | null } | { kind: 'deactivated' };

/**
 * `isLocked` stays `true` after `lockedUntil` passes until the person next signs in (the lock lifts
 * then), so a lapsed lock reads as active here — the badge, the *Access* row and the Lock / Unlock
 * choice all use this.
 */
export function userStatus(
  user: { deletedAt: string | null; isLocked: boolean; lockedUntil: string | null },
  now: Date,
): UserStatus {
  if (user.deletedAt) return { kind: 'deactivated' };
  if (
    user.isLocked &&
    (user.lockedUntil === null || Date.parse(user.lockedUntil) > now.getTime())
  ) {
    return { kind: 'locked', until: user.lockedUntil };
  }
  return { kind: 'active' };
}
