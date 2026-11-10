/**
 * The Content-Security-Policy (conventions §11, architecture §4.2): a per-request nonce on
 * `script-src`, so an injected `<script>` never runs. Pure — `proxy.ts` feeds it the request's
 * nonce and the origins our own env names, so no host of ours is typed here.
 */
export interface CspInput {
  nonce: string;
  /** `next dev`: React needs `eval` for its debugging, and HMR a WebSocket. Never in production. */
  dev: boolean;
  /** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` — Firebase's sign-in helper iframe. */
  firebaseAuthDomain: string;
  /** `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`, when set (local development and CI). */
  authEmulatorUrl?: string | undefined;
  /** `STORAGE_PUBLIC_BASE_URL` — where product photos load from. */
  storageBaseUrl: string;
}

const originOf = (url: string): string => new URL(url).origin;

export function buildCsp(input: CspInput): string {
  const emulator = input.authEmulatorUrl ? originOf(input.authEmulatorUrl) : undefined;
  const directives: string[][] = [
    ['default-src', "'self'"],
    // Next puts the nonce on every script it renders; `strict-dynamic` lets those load Stripe.js
    // and Google's sign-in script. The hosts are the fallback for a browser without it.
    [
      'script-src',
      "'self'",
      `'nonce-${input.nonce}'`,
      "'strict-dynamic'",
      'https://js.stripe.com',
      'https://apis.google.com',
      ...(input.dev ? ["'unsafe-eval'"] : []),
    ],
    // React `style` attributes and Stripe's injected styles; a style cannot run code.
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'blob:', originOf(input.storageBaseUrl), 'https://*.stripe.com'],
    ['font-src', "'self'"],
    [
      'connect-src',
      "'self'",
      'https://*.stripe.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      ...(emulator ? [emulator] : []),
      ...(input.dev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : []),
    ],
    // The Auth emulator serves its own helper iframe, so with it set the origin is a frame source too.
    [
      'frame-src',
      'https://*.stripe.com',
      `https://${input.firebaseAuthDomain}`,
      ...(emulator ? [emulator] : []),
    ],
    ['worker-src', "'self'"],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ];
  return directives.map((parts) => parts.join(' ')).join('; ');
}

/** A fresh nonce: unguessable, base64, one per request. */
export const newNonce = (): string => btoa(crypto.randomUUID());
