import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function loadRoute(): (request: { method: string; url: string; mode?: string }) => string {
  const self = { location: new URL('https://brewlite.test/sw.js?v=abc'), addEventListener() {} };
  const mod: { exports: { route?: never } } = { exports: {} };
  new Function('self', 'module', source)(self, mod);
  return mod.exports.route as never;
}

const route = loadRoute();
const get = (path: string, mode = 'cors') => ({
  method: 'GET',
  url: `https://brewlite.test${path}`,
  mode,
});

describe('service worker route()', () => {
  it('caches only build assets and icons', () => {
    expect(route(get('/_next/static/chunks/app.js'))).toBe('static');
    expect(route(get('/_next/static/media/font.woff2'))).toBe('static');
    expect(route(get('/icon-192.png'))).toBe('static');
    expect(route(get('/logo.svg'))).toBe('static');
  });

  it('serves the offline page for a failed navigation only', () => {
    expect(route(get('/', 'navigate'))).toBe('navigation');
    expect(route(get('/login', 'navigate'))).toBe('navigation');
  });

  it('never touches data', () => {
    expect(route(get('/?_rsc=1x2'))).toBe('network'); // an RSC fetch is not a navigation
    expect(route(get('/api/events/orders/abc'))).toBe('network');
    expect(route(get('/api/v1/menu'))).toBe('network');
    expect(route({ method: 'POST', url: 'https://brewlite.test/login', mode: 'cors' })).toBe(
      'network',
    );
    expect(route({ method: 'POST', url: 'https://brewlite.test/', mode: 'navigate' })).toBe(
      'network',
    );
  });

  it('never touches another origin', () => {
    expect(route({ method: 'GET', url: 'https://js.stripe.com/v3/', mode: 'cors' })).toBe(
      'network',
    );
    expect(
      route({ method: 'GET', url: 'https://identitytoolkit.googleapis.com/x', mode: 'cors' }),
    ).toBe('network');
  });
});
