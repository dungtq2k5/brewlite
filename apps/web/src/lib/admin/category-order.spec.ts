import { describe, expect, it } from 'vitest';
import { moveId, renumber } from './category-order';

const rows = [
  { id: 'coffee', sortOrder: 10 },
  { id: 'tea', sortOrder: 20 },
  { id: 'milk', sortOrder: 30 },
  { id: 'pastry', sortOrder: 40 },
];

describe('renumber', () => {
  it('changes nothing when the order did not change', () => {
    expect(renumber(rows, ['coffee', 'tea', 'milk', 'pastry'])).toEqual([]);
  });

  it('sends only the rows whose number changes — moving Pastry to the top touches all four', () => {
    expect(renumber(rows, ['pastry', 'coffee', 'tea', 'milk'])).toEqual([
      { id: 'pastry', sortOrder: 10 },
      { id: 'coffee', sortOrder: 20 },
      { id: 'tea', sortOrder: 30 },
      { id: 'milk', sortOrder: 40 },
    ]);
  });

  it('swapping the last two touches two rows', () => {
    expect(renumber(rows, ['coffee', 'tea', 'pastry', 'milk'])).toEqual([
      { id: 'pastry', sortOrder: 30 },
      { id: 'milk', sortOrder: 40 },
    ]);
  });

  it('closes the gaps of an unevenly numbered list', () => {
    const uneven = [
      { id: 'a', sortOrder: 5 },
      { id: 'b', sortOrder: 6 },
    ];
    expect(renumber(uneven, ['a', 'b'])).toEqual([
      { id: 'a', sortOrder: 10 },
      { id: 'b', sortOrder: 20 },
    ]);
  });
});

describe('moveId', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('moves an id to a position', () => {
    expect(moveId(ids, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveId(ids, 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('clamps to the ends', () => {
    expect(moveId(ids, 'b', -5)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveId(ids, 'b', 99)).toEqual(['a', 'c', 'd', 'b']);
  });
});
