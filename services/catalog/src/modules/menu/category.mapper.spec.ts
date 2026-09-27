import { describe, expect, it } from 'vitest';
import { toProtoCategory } from './category.mapper.js';

describe('toProtoCategory', () => {
  it('maps every field explicitly', () => {
    expect(toProtoCategory({ id: '01a', nameEn: 'Coffee', nameVi: 'Cà phê' })).toEqual({
      id: '01a',
      name: { en: 'Coffee', vi: 'Cà phê' },
    });
  });
});
