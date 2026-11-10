import { describe, expect, it } from 'vitest';
import { givenName } from './greeting';

describe('givenName', () => {
  it('takes the last word', () => {
    expect(givenName('Trần Minh Khoa')).toBe('Khoa');
    expect(givenName('  Hà ')).toBe('Hà');
  });
  it('is empty for nothing', () => {
    expect(givenName('')).toBe('');
  });
});
