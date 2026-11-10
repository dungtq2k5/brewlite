export type HeroVariant = 'full' | 'compact';

/** Which hero `/` renders, chosen on the server so nothing paints and then jumps away (product-overview §3.1). */
export function heroVariant(dismissed: boolean, signedIn: boolean): HeroVariant | null {
  if (dismissed) return null;
  return signedIn ? 'compact' : 'full';
}
