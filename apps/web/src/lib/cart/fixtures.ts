import { ProductSize } from '@brewlite/contracts';
import type { NewLine } from './cart';

/** Test builders only — nothing in the app imports this. */
export const topping = (id: string, priceVnd = 8_000) => ({
  id,
  name: { en: `Topping ${id}`, vi: `Topping ${id}` },
  priceVnd,
});

export const newLine = (overrides: Partial<NewLine> = {}): NewLine => ({
  productId: 'p1',
  categoryId: 'c1',
  noPhoto: 0,
  name: { en: 'Iced milk coffee', vi: 'Cà phê sữa đá' },
  imageUrl: null,
  size: ProductSize.S,
  basePriceVnd: 29_000,
  sizeDeltaVnd: 0,
  toppings: [],
  ...overrides,
});
