/** product-overview §6.2 — the one unit-price rule, run by catalog and by the web app's cart preview. */
export function computeUnitPrice(
  basePriceVnd: number,
  sizeDeltaVnd: number,
  toppingPricesVnd: readonly number[],
): number {
  for (const value of [basePriceVnd, sizeDeltaVnd, ...toppingPricesVnd]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`computeUnitPrice: ${value} is not a safe non-negative integer`);
    }
  }
  return basePriceVnd + sizeDeltaVnd + toppingPricesVnd.reduce((sum, price) => sum + price, 0);
}
