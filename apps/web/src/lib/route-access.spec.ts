import { describe, expect, it } from 'vitest';
import { needsAccount, roleRedirect } from './route-access';

describe('needsAccount', () => {
  it.each(['/checkout', '/orders', '/orders/abc', '/account'])('%s needs an account', (p) =>
    expect(needsAccount(p)).toBe(true),
  );
  it.each(['/', '/login', '/register', '/cart', '/orders-info', '/checkouts'])('%s does not', (p) =>
    expect(needsAccount(p)).toBe(false),
  );
});

describe('roleRedirect', () => {
  it('sends a customer or guest away from /staff and /admin', () => {
    expect(roleRedirect('/staff', 'CUSTOMER')).toBe('/');
    expect(roleRedirect('/admin/users', 'CUSTOMER')).toBe('/');
    expect(roleRedirect('/staff', undefined)).toBe('/');
  });
  it('lets staff into /staff but not /admin; admin into both', () => {
    expect(roleRedirect('/staff/products', 'STAFF')).toBeNull();
    expect(roleRedirect('/admin', 'STAFF')).toBe('/');
    expect(roleRedirect('/staff', 'ADMIN')).toBeNull();
    expect(roleRedirect('/admin', 'ADMIN')).toBeNull();
  });
  it('ignores everything else, and an unknown role gets no access', () => {
    expect(roleRedirect('/', 'CUSTOMER')).toBeNull();
    expect(roleRedirect('/staff', 'ROOT')).toBe('/');
  });
});
