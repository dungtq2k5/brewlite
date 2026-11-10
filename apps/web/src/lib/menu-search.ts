/**
 * Menu search on the device (≤ 200 products, already on the page): accents, case, `đ` and extra
 * spaces don't matter, and either language's name matches — *ca phe sua* finds *Cà phê sữa đá*.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd') // NFD does not decompose đ
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The normalized query is part of the English **or** the Vietnamese name; an empty query matches all. */
export function matches(product: { name: { en: string; vi: string } }, query: string): boolean {
  const q = normalize(query);
  if (q === '') return true;
  return normalize(product.name.en).includes(q) || normalize(product.name.vi).includes(q);
}
