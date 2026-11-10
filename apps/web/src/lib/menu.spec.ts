import { describe, expect, it } from 'vitest';
import { groupMenu, noPhotoVariant } from './menu';

const category = (id: string) => ({ id, name: { en: id, vi: id } });
const product = (id: string, categoryId: string) =>
  ({
    id,
    categoryId,
    name: { en: id, vi: id },
    imageUrl: null,
    fromPriceVnd: 1,
    isSoldOut: false,
  }) as never;

describe('groupMenu', () => {
  it('groups by category and keeps both lists in API order', () => {
    const sections = groupMenu(
      [category('coffee'), category('tea')],
      [
        product('t2', 'tea'),
        product('c1', 'coffee'),
        product('t1', 'tea'),
        product('c2', 'coffee'),
      ],
    );
    expect(sections.map((s) => s.category.id)).toEqual(['coffee', 'tea']);
    expect(sections[0]!.products.map((p) => p.id)).toEqual(['c1', 'c2']);
    expect(sections[1]!.products.map((p) => p.id)).toEqual(['t2', 't1']);
  });

  it('hides a category with no products, and keeps the positions of the others', () => {
    const sections = groupMenu(
      [category('a'), category('empty'), category('c')],
      [product('p1', 'a'), product('p2', 'c')],
    );
    expect(sections.map((s) => [s.category.id, s.position])).toEqual([
      ['a', 0],
      ['c', 2],
    ]);
  });

  it('ignores a product whose category is not listed', () => {
    expect(groupMenu([category('a')], [product('x', 'ghost')])).toEqual([]);
  });
});

describe('noPhotoVariant', () => {
  it('maps the seeded order exactly and cycles after five', () => {
    expect([0, 1, 2, 3, 4].map(noPhotoVariant)).toEqual([0, 1, 2, 3, 4]);
    expect([5, 6, 12].map(noPhotoVariant)).toEqual([0, 1, 2]);
  });
});
