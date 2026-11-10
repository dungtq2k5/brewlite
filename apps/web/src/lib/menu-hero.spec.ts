import { describe, expect, it } from 'vitest';
import { heroVariant } from './menu-hero';

describe('heroVariant', () => {
  it('renders nothing once dismissed, signed in or not', () => {
    expect(heroVariant(true, false)).toBeNull();
    expect(heroVariant(true, true)).toBeNull();
  });
  it('gives a signed-in customer the strip and a guest the full card', () => {
    expect(heroVariant(false, true)).toBe('compact');
    expect(heroVariant(false, false)).toBe('full');
  });
});
