import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

const h = (xff?: string) => new Headers(xff === undefined ? {} : { 'x-forwarded-for': xff });

describe('clientIp', () => {
  it('takes the rightmost entry, never the one a browser can write', () => {
    expect(clientIp(h('1.2.3.4, 203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(h('203.0.113.7'))).toBe('203.0.113.7');
  });
  it('is undefined without the header or with an empty one', () => {
    expect(clientIp(h())).toBeUndefined();
    expect(clientIp(h(''))).toBeUndefined();
    expect(clientIp(h('1.2.3.4, '))).toBeUndefined();
  });
});
