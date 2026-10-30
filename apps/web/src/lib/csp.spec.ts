import { describe, expect, it } from 'vitest';
import { buildCsp, newNonce } from './csp';

const base = {
  nonce: 'abc123',
  dev: false,
  firebaseAuthDomain: 'demo-brewlite.firebaseapp.com',
  storageBaseUrl: 'http://localhost:29199/some/path',
};

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('buildCsp', () => {
  it('puts the nonce, strict-dynamic and the script hosts in script-src', () => {
    const scripts = directive(buildCsp(base), 'script-src');
    expect(scripts).toEqual(
      expect.arrayContaining([
        "'self'",
        "'nonce-abc123'",
        "'strict-dynamic'",
        'https://js.stripe.com',
        'https://apis.google.com',
      ]),
    );
  });

  it("allows 'unsafe-eval' in development only", () => {
    expect(directive(buildCsp(base), 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(buildCsp({ ...base, dev: true }), 'script-src')).toContain("'unsafe-eval'");
    expect(directive(buildCsp(base), 'connect-src').some((s) => s.startsWith('ws:'))).toBe(false);
    expect(directive(buildCsp({ ...base, dev: true }), 'connect-src')).toContain(
      'ws://localhost:*',
    );
  });

  it('names the storage and emulator origins, with the path stripped', () => {
    const policy = buildCsp({ ...base, authEmulatorUrl: 'http://localhost:29099/emulator' });
    expect(directive(policy, 'img-src')).toContain('http://localhost:29199');
    expect(directive(policy, 'connect-src')).toContain('http://localhost:29099');
    expect(directive(policy, 'frame-src')).toContain('http://localhost:29099');
    expect(policy).not.toContain('/some/path');
    expect(policy).not.toContain('/emulator');
  });

  it('has no emulator source when its URL is unset', () => {
    const policy = buildCsp(base);
    expect(policy).not.toContain('29099');
    expect(directive(policy, 'frame-src')).toEqual([
      'https://*.stripe.com',
      'https://demo-brewlite.firebaseapp.com',
    ]);
  });

  it('closes everything else', () => {
    const policy = buildCsp(base);
    expect(directive(policy, 'default-src')).toEqual(["'self'"]);
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
    expect(directive(policy, 'worker-src')).toEqual(["'self'"]);
  });
});

describe('newNonce', () => {
  it('is different every time and base64', () => {
    const a = newNonce();
    expect(a).not.toBe(newNonce());
    expect(a).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
