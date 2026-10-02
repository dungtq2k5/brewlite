import { describe, expect, it } from 'vitest';
import { zBooleanParam, zPageQuery } from './paging.js';

describe('zPageQuery', () => {
  const schema = zPageQuery(['createdAt', 'email']);

  it('defaults page to 1 and pageSize to DEFAULT_PAGE_SIZE', () => {
    const result = schema.parse({ sort: 'createdAt' });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('coerces page and pageSize from query-string strings', () => {
    const result = schema.parse({ page: '3', pageSize: '50', sort: 'createdAt' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('refuses pageSize above MAX_PAGE_SIZE', () => {
    expect(() => schema.parse({ pageSize: '101', sort: 'createdAt' })).toThrow();
  });

  it('refuses page below 1', () => {
    expect(() => schema.parse({ page: '0', sort: 'createdAt' })).toThrow();
  });

  it('accepts a listed sort field, ascending and descending', () => {
    expect(schema.parse({ sort: 'email' }).sort).toBe('email');
    expect(schema.parse({ sort: '-email' }).sort).toBe('-email');
  });

  it('refuses an unlisted sort field', () => {
    expect(() => schema.parse({ sort: 'password' })).toThrow();
  });

  it('sort is required with no defaultSort', () => {
    expect(() => schema.parse({})).toThrow();
  });

  it('defaultSort makes sort optional', () => {
    const withDefault = zPageQuery(['createdAt', 'email'], '-createdAt');
    expect(withDefault.parse({}).sort).toBe('-createdAt');
  });
});

describe('zBooleanParam', () => {
  it('reads the literal string, not truthiness', () => {
    expect(zBooleanParam.parse('false')).toBe(false);
    expect(zBooleanParam.parse('true')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(() => zBooleanParam.parse('1')).toThrow();
    expect(() => zBooleanParam.parse('')).toThrow();
  });
});
