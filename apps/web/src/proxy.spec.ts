import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('@/lib/refresh', () => ({ refreshAccessToken: (...args: unknown[]) => refresh(...args) }));

vi.stubEnv('API_URL', 'http://api/api/v1');
vi.stubEnv('STORAGE_PUBLIC_BASE_URL', 'http://localhost:29199');
vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'k');
vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'demo.firebaseapp.com');
vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo');
const { proxy } = await import('./proxy');

const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const fresh = (role: string) => jwt({ role, exp: Date.now() / 1000 + 600 });

function request(path: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return new NextRequest(`http://localhost:23000${path}`, { headers: cookie ? { cookie } : {} });
}

beforeEach(() => refresh.mockReset());

describe('proxy', () => {
  it('step 2: sends a guest from /checkout to /login?next=', async () => {
    const res = await proxy(request('/checkout?x=1'));
    expect(res.status).toBe(307);
    expect(
      new URL(res.headers.get('location')!).pathname + new URL(res.headers.get('location')!).search,
    ).toBe('/login?next=%2Fcheckout%3Fx%3D1');
  });

  it('lets a guest see the menu and sign-in', async () => {
    expect((await proxy(request('/'))).headers.get('location')).toBeNull();
    expect((await proxy(request('/login'))).headers.get('location')).toBeNull();
  });

  it('step 3: roles', async () => {
    const to = (res: Response) => new URL(res.headers.get('location') ?? 'http://x/none').pathname;
    expect(to(await proxy(request('/staff', { bl_at: fresh('CUSTOMER') })))).toBe('/');
    expect(to(await proxy(request('/admin', { bl_at: fresh('STAFF') })))).toBe('/');
    expect(to(await proxy(request('/staff', { bl_at: fresh('STAFF') })))).toBe('/none');
    expect(to(await proxy(request('/admin', { bl_at: fresh('ADMIN') })))).toBe('/none');
    expect(to(await proxy(request('/staff')))).toBe('/');
  });

  it('step 1: refreshes a missing or soon-expired access token and signs this very render in', async () => {
    refresh.mockResolvedValue({
      kind: 'refreshed',
      accessToken: fresh('CUSTOMER'),
      accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(),
    });
    const res = await proxy(request('/', { bl_rt: 'rt' }));
    expect(res.headers.get('set-cookie')).toContain('bl_at=');
    expect(res.headers.get('set-cookie')).toContain('HttpOnly');
    expect(res.headers.get('x-middleware-request-cookie')).toContain('bl_at=');
    expect(refresh).toHaveBeenCalledTimes(1);

    refresh.mockClear();
    await proxy(request('/', { bl_at: jwt({ exp: Date.now() / 1000 + 10 }), bl_rt: 'rt' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh a healthy token or a guest', async () => {
    await proxy(request('/', { bl_at: fresh('CUSTOMER'), bl_rt: 'rt' }));
    await proxy(request('/'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a 401 on refresh clears both cookies and makes the visitor a guest again', async () => {
    refresh.mockResolvedValue({ kind: 'expired' });
    const res = await proxy(request('/orders', { bl_rt: 'rt' }));
    expect(res.status).toBe(307);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('bl_at=;');
    expect(setCookie).toContain('bl_rt=;');
  });

  it('a network failure leaves the cookies and renders as they are', async () => {
    refresh.mockResolvedValue({ kind: 'unchanged' });
    const res = await proxy(request('/', { bl_rt: 'rt' }));
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  describe('step 4: the Content-Security-Policy', () => {
    const nonceOf = (res: Response) =>
      /'nonce-([^']+)'/.exec(res.headers.get('content-security-policy') ?? '')?.[1];

    it('is on every page it lets through, with a nonce, and the same nonce is forwarded', async () => {
      const res = await proxy(request('/'));
      const nonce = nonceOf(res);
      expect(nonce).toBeTruthy();
      expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
      expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(
        res.headers.get('content-security-policy'),
      );
    });

    it('is a new nonce every request', async () => {
      expect(nonceOf(await proxy(request('/')))).not.toBe(nonceOf(await proxy(request('/'))));
    });

    it('also rides a refreshed render, beside the new cookie', async () => {
      refresh.mockResolvedValue({
        kind: 'refreshed',
        accessToken: fresh('CUSTOMER'),
        accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(),
      });
      const res = await proxy(request('/', { bl_rt: 'rt' }));
      expect(nonceOf(res)).toBeTruthy();
      expect(res.headers.get('x-middleware-request-cookie')).toContain('bl_at=');
    });

    it('is not put on a redirect', async () => {
      const res = await proxy(request('/checkout'));
      expect(res.status).toBe(307);
      expect(res.headers.get('content-security-policy')).toBeNull();
    });
  });
});
