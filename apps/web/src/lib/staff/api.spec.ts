import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInventory, loadOrders, requireStaff } from './api';
import {
  advanceStaffOrder,
  cancelStaffOrder,
  saveInventoryQuantity,
  saveStaffProfile,
  setInventoryAvailability,
} from './actions';
import type { StaffUser } from './contracts';
import { diagnosticError } from './diagnostics';
vi.mock('server-only', () => ({}));
vi.mock('@brewlite/api-client', () => import('../../../../../packages/api-client/src/index'));
const { cookie, revalidate } = vi.hoisted(() => ({ cookie: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookie }) }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
function diagnostics(level: 'info' | 'error') {
  return vi
    .mocked(console[level])
    .mock.calls.map(([line]) => JSON.parse(String(line).slice('[staff-api] '.length)));
}
const id = '01990000-0000-7000-8000-000000000001';
const staff: StaffUser = {
  id,
  email: 'staff@example.test',
  fullName: 'Test Staff',
  role: 'STAFF',
  permissions: ['stock.update', 'order.board.read', 'order.status.update', 'order.cancel.paid'],
  hasPassword: true,
  preferredLocale: 'en',
  createdAt: '2026-10-18T00:00:00Z',
};
const product = {
  id,
  categoryId: id,
  name: { en: 'Coffee', vi: 'Cà phê' },
  stockQty: 10,
  isAvailable: true,
  version: 0,
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
let user: StaffUser;
let calls: {
  path: string;
  init: RequestInit;
}[];
let handler: (path: string, init: RequestInit) => Response;
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  user = { ...staff, permissions: [...staff.permissions] };
  calls = [];
  cookie.mockReturnValue({ value: 'test-cookie-token' });
  handler = () => reply({ data: product });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({ path, init });
      if (path === '/api/v1/users/me' && init.method === 'GET') return reply({ data: user });
      return handler(path, init);
    }),
  );
});

describe('inventory empty responses and diagnostics', () => {
  it('serializes actual ApiClientError fields into a single labeled JSON log line', async () => {
    handler = (path) =>
      path.endsWith('toppings')
        ? reply({ error: { code: 'ROUTE_NOT_FOUND', details: 'private response' } }, 404)
        : reply({ data: [] });
    await loadInventory();
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        request: 'inventory.toppings',
        endpoint: '/staff/toppings',
        status: 404,
        error: expect.objectContaining({
          name: 'ApiClientError',
          message: '404 ROUTE_NOT_FOUND',
          status: 404,
          code: 'ROUTE_NOT_FOUND',
          stack: expect.stringContaining('404 ROUTE_NOT_FOUND'),
        }),
      }),
    );
    expect(
      vi
        .mocked(console.error)
        .mock.calls.every((call) => call.length === 1 && typeof call[0] === 'string'),
    ).toBe(true);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private response');
  });

  it('logs Zod issue paths and codes without copying response values into message or stack', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () =>
      reply({ data: { ...staff, email: { secret: 'private-email' } } }),
    );
    await loadInventory();
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        request: 'auth.current-user',
        stage: 'schema',
        status: 200,
        error: expect.objectContaining({
          name: 'ZodError',
          issues: [{ code: 'invalid_type', path: ['data', 'email'], expected: 'string' }],
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-email');
  });

  it('preserves nested cause/code and extracts non-enumerable Error fields safely', () => {
    const error = new TypeError('fetch failed', {
      cause: new Error('private endpoint and token', { cause: { code: 'ECONNREFUSED' } }),
    });
    const diagnostic = diagnosticError(error);
    expect(diagnostic).toEqual(
      expect.objectContaining({
        name: 'TypeError',
        message: 'fetch failed',
        stack: expect.stringContaining('TypeError: fetch failed'),
        cause: expect.objectContaining({
          name: 'Error',
          message: '[redacted message]',
          cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
        }),
      }),
    );
    expect(JSON.stringify(diagnostic)).not.toContain('private endpoint and token');
  });
  it('identifies invalid configuration before sending a gateway request', async () => {
    vi.stubEnv('GATEWAY_URL', 'http://example.test/api/v1?private=hidden');
    try {
      expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
      expect(fetch).not.toHaveBeenCalled();
      expect(diagnostics('error')).toContainEqual(
        expect.objectContaining({ stage: 'configuration' }),
      );
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('does not send inventory requests without the stock permission', async () => {
    user.permissions = [];
    expect(await loadInventory()).toEqual({ ok: false, error: 'forbidden' });
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/users/me']);
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/users/me',
        stage: 'access',
        reason: 'missing_permission',
      }),
    );
  });

  it('accepts HTTP 200 envelopes containing empty lists for both endpoints', async () => {
    handler = () => reply({ data: [] });
    expect(await loadInventory()).toEqual({ ok: true, data: { products: [], toppings: [] } });
    expect(calls.map((call) => call.path)).toEqual([
      '/api/v1/users/me',
      '/api/v1/staff/products',
      '/api/v1/staff/toppings',
    ]);
    for (const endpoint of ['/staff/products', '/staff/toppings']) {
      expect(diagnostics('info')).toContainEqual(
        expect.objectContaining({
          endpoint,
          stage: 'validated',
          status: 200,
          bodyType: 'object',
          dataType: 'array',
          itemCount: 0,
        }),
      );
    }
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    [],
    {},
    { items: [] },
    { data: null },
    { data: { items: [] } },
    { data: { products: [] } },
    { data: { data: [] } },
  ])('rejects an incorrect HTTP 200 body/envelope %j', async (body) => {
    handler = (path) => reply(path.endsWith('products') ? body : { data: [] });
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/products',
        stage: 'schema',
        status: 200,
      }),
    );
  });

  it('keeps the error when toppings returns 404 although products succeeds empty', async () => {
    handler = (path) =>
      path.endsWith('toppings')
        ? reply({ error: { code: 'ROUTE_NOT_FOUND' } }, 404)
        : reply({ data: [] });
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
    expect(diagnostics('info')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/products',
        stage: 'validated',
        status: 200,
        itemCount: 0,
      }),
    );
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/toppings',
        stage: 'http',
        status: 404,
        errorCode: 'ROUTE_NOT_FOUND',
      }),
    );
  });

  it.each([
    [401, 'UNAUTHENTICATED', 'unauthenticated'],
    [403, 'FORBIDDEN', 'forbidden'],
    [500, 'INTERNAL', 'requestFailed'],
    [503, 'SERVICE_UNAVAILABLE', 'requestFailed'],
  ])('preserves HTTP failure %s instead of returning empty data', async (status, code, error) => {
    handler = (path) =>
      path.endsWith('products') ? reply({ error: { code } }, Number(status)) : reply({ data: [] });
    expect(await loadInventory()).toEqual({ ok: false, error });
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/products',
        stage: 'http',
        status,
        errorCode: code,
      }),
    );
  });

  it('does not send inventory requests when current-user authentication fails', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () =>
      reply({ error: { code: 'UNAUTHENTICATED' } }, 401),
    );
    expect(await loadInventory()).toEqual({ ok: false, error: 'unauthenticated' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/users/me',
        stage: 'http',
        status: 401,
        errorCode: 'UNAUTHENTICATED',
      }),
    );
  });

  it('distinguishes current-user schema failure from inventory schema failure', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => reply({ data: {} }));
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/users/me',
        stage: 'schema',
        status: 200,
        bodyType: 'object',
        dataType: 'object',
      }),
    );
  });

  it('distinguishes network failure without logging headers, body or exception messages', async () => {
    handler = (path) => {
      if (path.endsWith('products'))
        throw new TypeError('private host and token', { cause: { code: 'ECONNREFUSED' } });
      return reply({ data: [] });
    };
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/products',
        stage: 'transport',
        networkCode: 'ECONNREFUSED',
      }),
    );
    const logs = JSON.stringify([
      vi.mocked(console.info).mock.calls,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const value of [
      'private host and token',
      'test-cookie-token',
      staff.email,
      staff.fullName,
    ])
      expect(logs).not.toContain(value);
  });

  it('distinguishes JSON decode errors from Zod validation errors', async () => {
    handler = (path) =>
      path.endsWith('products')
        ? new Response('invalid json', { status: 200 })
        : reply({ data: [] });
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
    expect(diagnostics('error')).toContainEqual(
      expect.objectContaining({
        endpoint: '/staff/products',
        stage: 'response-json',
      }),
    );
  });
});
describe('staff generated server integration', () => {
  it('verifies session through users/me and sends the cookie only in server headers', async () => {
    expect((await requireStaff('stock.update')).fullName).toBe(staff.fullName);
    expect(calls[0].path).toBe('/api/v1/users/me');
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe(
      'Bearer test-cookie-token',
    );
    expect(calls[0].init.cache).toBe('no-store');
  });
  it('rejects missing cookies without a gateway call', async () => {
    cookie.mockReturnValue(undefined);
    expect(await saveStaffProfile({ fullName: 'Changed' })).toEqual({
      ok: false,
      error: 'unauthenticated',
    });
    expect(calls).toHaveLength(0);
  });
  it.each(['CUSTOMER', 'ADMIN'] as const)(
    'rejects non-staff role %s on the server',
    async (role) => {
      user.role = role;
      expect(await setInventoryAvailability('products', id, false)).toEqual({
        ok: false,
        error: 'forbidden',
      });
      expect(calls).toHaveLength(1);
    },
  );
  it('rechecks permission for each mutation', async () => {
    user.permissions = [];
    expect(await advanceStaffOrder(id, { to: 'PREPARING' })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await cancelStaffOrder(id, { note: 'Unavailable' })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await saveInventoryQuantity(id, { stockQty: 3, expectedVersion: 0 }, false)).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(calls.every((call) => call.init.method === 'GET')).toBe(true);
  });
  it.each([-1, 1.5, 2147483648])('validates stock %s before any write', async (stockQty) => {
    expect(await saveInventoryQuantity(id, { stockQty, expectedVersion: 0 }, false)).toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(calls).toHaveLength(1);
  });
  it('sends absolute zero with expected version and disables sales before stock write', async () => {
    const saved = { ...product, isAvailable: false, stockQty: 0, version: 1 };
    handler = () => reply({ data: saved });
    expect(await saveInventoryQuantity(id, { stockQty: 0, expectedVersion: 0 }, true)).toEqual({
      ok: true,
      data: saved,
    });
    expect(calls.slice(1).map((call) => call.path.split('/').at(-1))).toEqual([
      'availability',
      'stock',
    ]);
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ stockQty: 0, expectedVersion: 0 });
    expect(revalidate).toHaveBeenCalledWith('/staff/stocks');
  });
  it('preserves null stock and maps version conflicts without leaking details', async () => {
    handler = () =>
      reply({ error: { code: 'STOCK_VERSION_CONFLICT', details: 'private data' } }, 409);
    expect(await saveInventoryQuantity(id, { stockQty: null, expectedVersion: 7 }, true)).toEqual({
      ok: false,
      error: 'conflict',
    });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ stockQty: null, expectedVersion: 7 });
  });
  it('validates response bodies and rejects malformed inventory without mock fallback', async () => {
    handler = (path) =>
      reply({ data: path.endsWith('products') ? [{ ...product, stockQty: 'ten' }] : [] });
    expect(await loadInventory()).toEqual({ ok: false, error: 'requestFailed' });
  });
  it('loads complete product and topping lists with generated envelopes', async () => {
    handler = (path) => reply({ data: path.endsWith('products') ? [product] : [] });
    expect(await loadInventory()).toEqual({
      ok: true,
      data: { products: [product], toppings: [] },
    });
  });
  it('documents the existing nullable order contract mismatch through validation', async () => {
    handler = () =>
      reply({
        data: [
          {
            lines: [],
            subtotalVnd: 30000,
            promoDiscountVnd: 1000,
            pointsDiscountVnd: 0,
            totalVnd: 29000,
            promoCode: null,
            pointsEarnable: 0,
            id,
            orderNo: 'TEST1',
            status: 'PAID',
            note: null,
            expiresAt: null,
            paidAt: '2026-10-18T00:00:00Z',
            createdAt: '2026-10-18T00:00:00Z',
            cancelReason: null,
            cancelNote: null,
            refundStatus: 'NONE',
            pointsEarned: 0,
            history: [],
          },
        ],
      });
    expect(await loadOrders()).toEqual({ ok: false, error: 'requestFailed' });
  });
  it('normalizes account input, validates limits and sends only supported fields', async () => {
    handler = () => reply({ data: { ...staff, fullName: 'Test Changed', preferredLocale: 'vi' } });
    const result = await saveStaffProfile({ fullName: '  Test Changed  ', preferredLocale: 'vi' });
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      fullName: 'Test Changed',
      preferredLocale: 'vi',
    });
    expect(await saveStaffProfile({ fullName: 'x'.repeat(101) })).toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(await saveStaffProfile({ fullName: 'Allowed', avatar: 'unsupported' })).toEqual({
      ok: false,
      error: 'invalidInput',
    });
  });
});
