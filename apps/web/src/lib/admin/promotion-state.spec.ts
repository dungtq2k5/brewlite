import { describe, expect, it } from 'vitest';
import { promotionState } from './promotion-state';

const base = {
  isActive: true,
  startsAt: '2026-06-01T00:00:00.000Z',
  endsAt: '2026-07-01T00:00:00.000Z',
  maxUses: 10 as number | null,
  usedCount: 3,
};
const at = (iso: string) => new Date(iso);

describe('promotionState', () => {
  it('runs inside its window', () => {
    expect(promotionState(base, at('2026-06-15T00:00:00Z'))).toBe('running');
  });
  it('is scheduled before the start and ended from the end instant', () => {
    expect(promotionState(base, at('2026-05-31T23:59:59Z'))).toBe('scheduled');
    expect(promotionState(base, at('2026-06-01T00:00:00Z'))).toBe('running');
    expect(promotionState(base, at('2026-07-01T00:00:00Z'))).toBe('ended');
  });
  it('is used up at the cap, never with no cap', () => {
    expect(promotionState({ ...base, usedCount: 10 }, at('2026-06-15T00:00:00Z'))).toBe('usedUp');
    expect(
      promotionState({ ...base, maxUses: null, usedCount: 999 }, at('2026-06-15T00:00:00Z')),
    ).toBe('running');
  });
  it('puts switched off before everything else', () => {
    const off = { ...base, isActive: false, usedCount: 10 };
    expect(promotionState(off, at('2026-05-01T00:00:00Z'))).toBe('switchedOff');
    expect(promotionState(off, at('2026-08-01T00:00:00Z'))).toBe('switchedOff');
  });
  it('puts ended before used up', () => {
    expect(promotionState({ ...base, usedCount: 10 }, at('2026-08-01T00:00:00Z'))).toBe('ended');
  });
});
