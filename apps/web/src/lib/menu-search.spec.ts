import { describe, expect, it } from 'vitest';
import { matches, normalize } from './menu-search';

const product = (en: string, vi: string) => ({ name: { en, vi } });

describe('normalize', () => {
  it('drops accents, case and extra spaces, and maps đ to d', () => {
    expect(normalize('  Cà   PHÊ  sữa ĐÁ ')).toBe('ca phe sua da');
    expect(normalize('Đá xay')).toBe('da xay');
  });
});

describe('matches', () => {
  const iced = product('Iced milk coffee', 'Cà phê sữa đá');
  it('finds the Vietnamese name typed without accents', () => {
    expect(matches(iced, 'ca phe sua')).toBe(true);
    expect(matches(iced, 'sua da')).toBe(true);
  });
  it('finds the English name from either UI, and accented queries too', () => {
    expect(matches(iced, 'MILK')).toBe(true);
    expect(matches(product('Brown sugar milk tea', 'Trà sữa đường đen'), 'trà sữa')).toBe(true);
  });
  it('does not match what is not there; an empty query matches everything', () => {
    expect(matches(iced, 'matcha')).toBe(false);
    expect(matches(iced, '   ')).toBe(true);
  });
});
