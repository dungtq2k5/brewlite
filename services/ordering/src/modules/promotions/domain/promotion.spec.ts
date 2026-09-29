import { describe, expect, it } from 'vitest';
import { DiscountType } from '@brewlite/contracts';
import { applyPromotion, validatePromotion, type PromotionRule } from './promotion.js';

const NOW = new Date('2026-06-15T00:00:00Z');

function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    discountType: DiscountType.PERCENT,
    discountValue: 10,
    maxDiscountVnd: null,
    minSubtotalVnd: 0,
    startsAt: new Date('2026-06-01T00:00:00Z'),
    endsAt: new Date('2026-07-01T00:00:00Z'),
    maxUses: null,
    usedCount: 0,
    perUserLimit: null,
    isActive: true,
    ...overrides,
  };
}

function ctx(
  overrides: Partial<{ subtotalVnd: number; now: Date; usesByThisCustomer: number }> = {},
) {
  return { subtotalVnd: 58_000, now: NOW, usesByThisCustomer: 0, ...overrides };
}

describe('validatePromotion', () => {
  it('NOT_FOUND for a null promotion', () => {
    expect(validatePromotion(null, ctx())).toBe('NOT_FOUND');
  });

  it('INACTIVE beats every later reason', () => {
    expect(
      validatePromotion(rule({ isActive: false, startsAt: new Date('2099-01-01') }), ctx()),
    ).toBe('INACTIVE');
  });

  it('NOT_STARTED', () => {
    expect(validatePromotion(rule({ startsAt: new Date('2099-01-01') }), ctx())).toBe(
      'NOT_STARTED',
    );
  });

  it('EXPIRED, including exactly at ends_at', () => {
    expect(validatePromotion(rule({ endsAt: NOW }), ctx())).toBe('EXPIRED');
  });

  it('MIN_SUBTOTAL', () => {
    expect(validatePromotion(rule({ minSubtotalVnd: 100_000 }), ctx({ subtotalVnd: 58_000 }))).toBe(
      'MIN_SUBTOTAL',
    );
  });

  it('EXHAUSTED', () => {
    expect(validatePromotion(rule({ maxUses: 5, usedCount: 5 }), ctx())).toBe('EXHAUSTED');
  });

  it('PER_USER_LIMIT', () => {
    expect(validatePromotion(rule({ perUserLimit: 1 }), ctx({ usesByThisCustomer: 1 }))).toBe(
      'PER_USER_LIMIT',
    );
  });

  it('a promotion failing several checks at once reports the first', () => {
    expect(
      validatePromotion(
        rule({ isActive: false, maxUses: 1, usedCount: 1, perUserLimit: 1 }),
        ctx({ usesByThisCustomer: 1 }),
      ),
    ).toBe('INACTIVE');
  });

  it('a valid promotion returns null', () => {
    expect(validatePromotion(rule(), ctx())).toBeNull();
  });
});

describe('applyPromotion', () => {
  it('PERCENT rounds down', () => {
    expect(applyPromotion(rule({ discountValue: 10 }), 58_000)).toBe(5_800);
    expect(applyPromotion(rule({ discountValue: 15 }), 12_345)).toBe(1_851);
  });

  it('a cap limits a PERCENT discount', () => {
    expect(applyPromotion(rule({ discountValue: 50, maxDiscountVnd: 10_000 }), 100_000)).toBe(
      10_000,
    );
  });

  it('FIXED returns the flat value', () => {
    expect(
      applyPromotion(rule({ discountType: DiscountType.FIXED, discountValue: 15_000 }), 58_000),
    ).toBe(15_000);
  });

  it('FIXED above the subtotal is clamped so the total stays at MIN_PAYABLE_VND', () => {
    // subtotal 20,000, MIN_PAYABLE_VND 10,000 → the discount can be at most 10,000.
    expect(
      applyPromotion(rule({ discountType: DiscountType.FIXED, discountValue: 50_000 }), 20_000),
    ).toBe(10_000);
  });

  it('a PERCENT discount that would otherwise breach MIN_PAYABLE_VND is capped the same way', () => {
    expect(applyPromotion(rule({ discountValue: 90 }), 20_000)).toBe(10_000);
  });
});
