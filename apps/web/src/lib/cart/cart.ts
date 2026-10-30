import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  compareStrings,
  computeUnitPrice,
  type LocalizedText,
  type ProductSize,
} from '@brewlite/contracts';

/**
 * The cart lives on the device (architecture §4.3). A line is a **snapshot** — both languages of
 * every name and the prices as the customer saw them — so a language switch re-renders it with
 * no fetch. It is a preview: the checkout shows the server's quote.
 */
export interface CartTopping {
  id: string;
  name: LocalizedText;
  priceVnd: number;
}

export interface CartLine {
  /** `productId|size|<sorted topping ids>` — identical lines merge on it. */
  key: string;
  productId: string;
  categoryId: string;
  /**
   * Which of the five no-photo looks the product's category gets (0…4, by the category's
   * position in the menu). Kept in the snapshot because the cart page calls no API.
   */
  noPhoto: number;
  name: LocalizedText;
  imageUrl: string | null;
  size: ProductSize;
  basePriceVnd: number;
  sizeDeltaVnd: number;
  toppings: CartTopping[];
  /** 1…MAX_QTY_PER_LINE */
  quantity: number;
}

export interface Cart {
  v: 1;
  lines: CartLine[];
}

export const EMPTY_CART: Cart = { v: 1, lines: [] };

/** A line as the product page builds it — the key and the quantity are the cart's business. */
export type NewLine = Omit<CartLine, 'key' | 'quantity'>;

export function lineKey(productId: string, size: string, toppingIds: readonly string[]): string {
  return `${productId}|${size}|${[...toppingIds].sort(compareStrings).join(',')}`;
}

export const keyOf = (line: Pick<CartLine, 'productId' | 'size' | 'toppings'>) =>
  lineKey(
    line.productId,
    line.size,
    line.toppings.map((t) => t.id),
  );

export const itemCount = (cart: Cart): number => cart.lines.reduce((n, l) => n + l.quantity, 0);
export const lineCount = (cart: Cart): number => cart.lines.length;

export const findLine = (cart: Cart, key: string): CartLine | undefined =>
  cart.lines.find((l) => l.key === key);

export const quantityOf = (cart: Cart, key: string): number => findLine(cart, key)?.quantity ?? 0;

/** One unit — through the contracts function catalog also runs, never a second formula. */
export const unitPriceVnd = (line: Pick<CartLine, 'basePriceVnd' | 'sizeDeltaVnd' | 'toppings'>) =>
  computeUnitPrice(
    line.basePriceVnd,
    line.sizeDeltaVnd,
    line.toppings.map((t) => t.priceVnd),
  );

export const lineTotalVnd = (line: CartLine): number => unitPriceVnd(line) * line.quantity;

/** `exclude` holds the keys of lines the server said are unavailable — they are not counted. */
export function totalVnd(cart: Cart, exclude: ReadonlySet<string> = new Set()): number {
  return cart.lines.reduce((sum, l) => (exclude.has(l.key) ? sum : sum + lineTotalVnd(l)), 0);
}

/**
 * Whether adding this combination can change the cart: it raises an existing line that is
 * below the quantity cap, or it is a new line and the cart has room (20 *lines*, not items).
 */
export function canAdd(cart: Cart, key: string): boolean {
  const existing = findLine(cart, key);
  return existing ? existing.quantity < MAX_QTY_PER_LINE : cart.lines.length < MAX_LINES_PER_ORDER;
}

export interface AddResult {
  cart: Cart;
  /** How many were actually added — less than asked at the quantity cap, 0 when refused. */
  added: number;
}

export function add(cart: Cart, line: NewLine, quantity: number): AddResult {
  const key = keyOf(line);
  const wanted = Math.max(0, Math.floor(quantity));
  const existing = findLine(cart, key);
  if (existing) {
    const next = Math.min(MAX_QTY_PER_LINE, existing.quantity + wanted);
    const added = next - existing.quantity;
    if (added === 0) return { cart, added: 0 };
    return {
      cart: {
        ...cart,
        lines: cart.lines.map((l) => (l.key === key ? { ...l, quantity: next } : l)),
      },
      added,
    };
  }
  if (wanted === 0 || cart.lines.length >= MAX_LINES_PER_ORDER) return { cart, added: 0 };
  const added = Math.min(MAX_QTY_PER_LINE, wanted);
  return { cart: { ...cart, lines: [...cart.lines, { ...line, key, quantity: added }] }, added };
}

/** The stepper: clamps to 1…10; a missing key changes nothing. */
export function setQuantity(cart: Cart, key: string, quantity: number): Cart {
  if (!findLine(cart, key)) return cart;
  const next = Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.floor(quantity)));
  return { ...cart, lines: cart.lines.map((l) => (l.key === key ? { ...l, quantity: next } : l)) };
}

export interface RemoveResult {
  cart: Cart;
  /** What *Undo* needs: the line and where it was. */
  removed?: { line: CartLine; index: number };
}

export function remove(cart: Cart, key: string): RemoveResult {
  const index = cart.lines.findIndex((l) => l.key === key);
  if (index === -1) return { cart };
  return {
    cart: { ...cart, lines: cart.lines.filter((_, i) => i !== index) },
    removed: { line: cart.lines[index]!, index },
  };
}

/**
 * *Undo*: puts a removed line back where it was. If the same combination was added again in
 * the meantime the quantities merge (capped); if the cart filled up meanwhile, nothing happens.
 */
export function restore(cart: Cart, line: CartLine, index: number): Cart {
  const existing = findLine(cart, line.key);
  if (existing) {
    return setQuantity(cart, line.key, existing.quantity + line.quantity);
  }
  if (cart.lines.length >= MAX_LINES_PER_ORDER) return cart;
  const at = Math.min(Math.max(0, index), cart.lines.length);
  return { ...cart, lines: [...cart.lines.slice(0, at), line, ...cart.lines.slice(at)] };
}
