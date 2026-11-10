export type PromotionState = 'switchedOff' | 'scheduled' | 'ended' | 'usedUp' | 'running';

/**
 * What a promotion is doing right now, in the design's order (decision 6): switched off first, then
 * not started, then over, then out of uses, else running.
 */
export function promotionState(
  p: {
    isActive: boolean;
    startsAt: string;
    endsAt: string;
    maxUses: number | null;
    usedCount: number;
  },
  now: Date,
): PromotionState {
  if (!p.isActive) return 'switchedOff';
  if (now.getTime() < Date.parse(p.startsAt)) return 'scheduled';
  if (now.getTime() >= Date.parse(p.endsAt)) return 'ended';
  if (p.maxUses !== null && p.usedCount >= p.maxUses) return 'usedUp';
  return 'running';
}
