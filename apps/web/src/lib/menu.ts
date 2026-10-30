import type { CategoryResponseDto, ProductSummaryResponseDto } from '@brewlite/api-client';

export interface MenuSection {
  category: CategoryResponseDto;
  /** The category's place in the *whole* category list — what picks its no-photo look. */
  position: number;
  products: ProductSummaryResponseDto[];
}

/**
 * Products grouped by category, both lists in the API's order (the screen never re-sorts).
 * A category with no products is left out: no chip, no heading (D02 §3.10).
 */
export function groupMenu(
  categories: readonly CategoryResponseDto[],
  products: readonly ProductSummaryResponseDto[],
): MenuSection[] {
  const byCategory = new Map<string, ProductSummaryResponseDto[]>();
  for (const product of products) {
    const list = byCategory.get(product.categoryId);
    if (list) list.push(product);
    else byCategory.set(product.categoryId, [product]);
  }
  return categories.flatMap((category, position) => {
    const list = byCategory.get(category.id);
    return list ? [{ category, position, products: list }] : [];
  });
}

export const NO_PHOTO_LOOKS = 5;

/** Coffee, Tea, Milk tea, Blended, Pastry — then around again, so a new category still gets one. */
export const noPhotoVariant = (position: number): number =>
  ((position % NO_PHOTO_LOOKS) + NO_PHOTO_LOOKS) % NO_PHOTO_LOOKS;
