import { describe, expect, it } from 'vitest';
import {
  firstParam,
  hrefWith,
  pageCount,
  pageRange,
  pageWindow,
  readChoice,
  readFlag,
  readOptionalChoice,
  readPage,
  readSearch,
} from './list-params';

describe('readPage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['3', 3],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
    ['99999', 1],
  ])('%j → %i', (value, expected) => {
    expect(readPage({ page: value })).toBe(expected);
  });
});

describe('readChoice', () => {
  const sorts = ['sortOrder', '-createdAt', 'nameEn'] as const;
  it('keeps a value on the allowlist', () => {
    expect(readChoice({ sort: '-createdAt' }, 'sort', sorts, 'sortOrder')).toBe('-createdAt');
  });
  it('falls back for an unknown or missing one — never an error', () => {
    expect(readChoice({ sort: 'password' }, 'sort', sorts, 'sortOrder')).toBe('sortOrder');
    expect(readChoice({}, 'sort', sorts, 'sortOrder')).toBe('sortOrder');
  });
  it('takes the first of a repeated parameter', () => {
    expect(firstParam({ sort: ['nameEn', 'x'] }, 'sort')).toBe('nameEn');
  });
});

describe('readOptionalChoice, readFlag, readSearch', () => {
  it('a filter is off unless its value is allowed', () => {
    expect(readOptionalChoice({ role: 'STAFF' }, 'role', ['STAFF', 'ADMIN'])).toBe('STAFF');
    expect(readOptionalChoice({ role: 'ROOT' }, 'role', ['STAFF', 'ADMIN'])).toBeUndefined();
  });
  it('deleted is on only for the word true', () => {
    expect(readFlag({ deleted: 'true' }, 'deleted')).toBe(true);
    expect(readFlag({ deleted: '1' }, 'deleted')).toBe(false);
    expect(readFlag({}, 'deleted')).toBe(false);
  });
  it('a search is trimmed and bounded', () => {
    expect(readSearch({ q: '  latte ' })).toBe('latte');
    expect(readSearch({ q: 'x'.repeat(300) })).toHaveLength(100);
  });
});

describe('hrefWith', () => {
  const defaults = { sort: 'sortOrder' };
  it('adds a filter and goes back to page 1', () => {
    expect(
      hrefWith('/admin/products', { page: '3', q: 'tea' }, { categoryId: 'c1' }, defaults),
    ).toBe('/admin/products?q=tea&categoryId=c1');
  });
  it('drops empty values and the defaults', () => {
    expect(
      hrefWith(
        '/admin/products',
        { q: 'tea', sort: 'nameEn' },
        { q: '', sort: 'sortOrder' },
        defaults,
      ),
    ).toBe('/admin/products');
  });
  it('keeps the page when the patch is the page', () => {
    expect(hrefWith('/admin/products', { q: 'tea' }, { page: '2' })).toBe(
      '/admin/products?q=tea&page=2',
    );
  });
});

describe('pageRange and pageCount', () => {
  it('says 21–40 of 132', () => {
    expect(pageRange(2, 20, 132)).toEqual({ from: 21, to: 40, total: 132 });
    expect(pageRange(7, 20, 132)).toEqual({ from: 121, to: 132, total: 132 });
  });
  it('has nothing to show for an empty list, and always at least one page', () => {
    expect(pageRange(1, 20, 0)).toBeNull();
    expect(pageCount(20, 0)).toBe(1);
    expect(pageCount(20, 41)).toBe(3);
  });
});

describe('pageWindow', () => {
  it('shows every page of a short list', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it('keeps first, last and the current ±1 with gaps', () => {
    expect(pageWindow(2, 7)).toEqual([1, 2, 3, null, 7]);
    expect(pageWindow(5, 12)).toEqual([1, null, 4, 5, 6, null, 12]);
    expect(pageWindow(9, 9)).toEqual([1, null, 8, 9]);
  });
  it('fills a single-page gap instead of an ellipsis', () => {
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
