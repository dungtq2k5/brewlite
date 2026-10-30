import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import enCart from '@/i18n/locales/en/cart.json';
import viCart from '@/i18n/locales/vi/cart.json';
import { ProductSize } from '@brewlite/contracts';
import { newLine, topping } from './fixtures';
import { unavailableText, type UnavailableReason } from './unavailable';

const line = {
  ...newLine({
    size: ProductSize.L,
    toppings: [{ ...topping('c'), name: { en: 'Cheese foam', vi: 'Kem phô mai' } }],
  }),
};

const make = async (lng: 'en' | 'vi', cart: object) => {
  const i = createInstance();
  await i.init({
    lng,
    resources: { [lng]: { cart } },
    ns: ['cart'],
    interpolation: { escapeValue: false },
  });
  return i.t;
};

let en: Awaited<ReturnType<typeof make>>;
let vi: Awaited<ReturnType<typeof make>>;
beforeAll(async () => {
  en = await make('en', enCart);
  vi = await make('vi', viCart);
});

const cases: [UnavailableReason, string, string][] = [
  [{ code: 'PRODUCT_UNAVAILABLE' }, 'Sold out for today', 'Hôm nay hết món'],
  [
    { code: 'OPTION_INVALID', reason: 'SIZE' },
    "Size L isn't offered any more",
    'Cỡ L không còn phục vụ',
  ],
  [
    { code: 'OPTION_INVALID', reason: 'TOPPING', toppingName: 'Cheese foam' },
    "Cheese foam isn't available any more",
    'Cheese foam không còn',
  ],
  [
    { code: 'OPTION_INVALID', reason: 'TOO_MANY_TOPPINGS' },
    'This drink now takes fewer toppings',
    'Món này giờ chỉ nhận ít topping hơn',
  ],
  [
    { code: 'OUT_OF_STOCK', available: 2 },
    'Only 2 left — lower the quantity or remove it',
    'Chỉ còn 2 — giảm số lượng hoặc bỏ món',
  ],
];

describe('the unavailable line', () => {
  it.each(cases)('says %j in both languages', (reason, english, vietnamese) => {
    expect(unavailableText(en, reason, line, 'en')).toBe(english);
    expect(unavailableText(vi, reason, line, 'vi')).toBe(vietnamese);
  });

  it('names the topping when the line has exactly one', () => {
    const reason: UnavailableReason = { code: 'OPTION_INVALID', reason: 'TOPPING' };
    expect(unavailableText(en, reason, line, 'en')).toBe("Cheese foam isn't available any more");
    expect(unavailableText(vi, reason, line, 'vi')).toBe('Kem phô mai không còn');
  });

  it('does not guess among several toppings, and says so without a name', () => {
    const reason: UnavailableReason = { code: 'OPTION_INVALID', reason: 'TOPPING' };
    const two = { ...line, toppings: [...line.toppings, topping('p')] };
    expect(unavailableText(en, reason, two, 'en')).toBe(
      "A topping on this drink isn't available any more",
    );
    expect(unavailableText(vi, reason, two, 'vi')).toBe('Một topping của món này không còn');
  });

  it('a reason that names its topping is believed, whatever the line holds', () => {
    const reason: UnavailableReason = {
      code: 'OPTION_INVALID',
      reason: 'TOPPING',
      toppingName: 'Pearls',
    };
    const two = { ...line, toppings: [...line.toppings, topping('p')] };
    expect(unavailableText(en, reason, two, 'en')).toBe("Pearls isn't available any more");
  });
});
