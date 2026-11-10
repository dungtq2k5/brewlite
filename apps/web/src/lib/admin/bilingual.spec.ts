import { describe, expect, it } from 'vitest';
import { checkPair, toLocalized } from './bilingual';

const rule = { required: true, max: 10 };

describe('checkPair — a required pair', () => {
  it('is fine when both are filled', () => {
    expect(checkPair({ en: 'Tea', vi: 'Trà' }, rule)).toEqual([]);
  });
  it('names the empty language', () => {
    expect(checkPair({ en: 'Tea', vi: '' }, rule)).toEqual([{ language: 'vi', kind: 'missing' }]);
    expect(checkPair({ en: '  ', vi: 'Trà' }, rule)).toEqual([{ language: 'en', kind: 'missing' }]);
  });
  it('names both when both are empty', () => {
    expect(checkPair({ en: '', vi: '' }, rule)).toHaveLength(2);
  });
});

describe('checkPair — an optional pair', () => {
  const optional = { required: false, max: 10 };
  it('both empty is fine', () => {
    expect(checkPair({ en: '', vi: '  ' }, optional)).toEqual([]);
  });
  it('one side filled asks for the other', () => {
    expect(checkPair({ en: 'Cold', vi: '' }, optional)).toEqual([
      { language: 'vi', kind: 'missing' },
    ]);
    expect(checkPair({ en: '', vi: 'Lạnh' }, optional)).toEqual([
      { language: 'en', kind: 'missing' },
    ]);
  });
});

describe('checkPair — length', () => {
  it('judges the trimmed value against the limit, per language', () => {
    expect(checkPair({ en: ' abcdefghij ', vi: 'abcdefghijk' }, rule)).toEqual([
      { language: 'vi', kind: 'tooLong', max: 10 },
    ]);
  });
});

describe('toLocalized', () => {
  it('trims, and is null for an empty optional pair', () => {
    expect(toLocalized({ en: ' Tea ', vi: ' Trà ' })).toEqual({ en: 'Tea', vi: 'Trà' });
    expect(toLocalized({ en: ' ', vi: '' })).toBeNull();
  });
});
