import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { errorMessage } from './error-message';
import enErrors from './locales/en/errors.json';
import viErrors from './locales/vi/errors.json';

let en: ReturnType<typeof createInstance>;
let vi: ReturnType<typeof createInstance>;

beforeAll(async () => {
  const make = async (lng: string, errors: object) => {
    const i = createInstance();
    await i.init({
      lng,
      resources: { [lng]: { errors } },
      ns: ['errors'],
      interpolation: { escapeValue: false },
    });
    return i;
  };
  en = await make('en', enErrors);
  vi = await make('vi', viErrors);
});

describe('errorMessage', () => {
  it('shows the lock time in Vietnam time, or the indefinite variant', () => {
    expect(
      errorMessage(en.t, 'en', 'ACCOUNT_LOCKED', { lockedUntil: '2026-10-21T07:30:00Z' }),
    ).toBe('This account is locked until 14:30, 21 Oct. You can sign in again after that.');
    expect(
      errorMessage(vi.t, 'vi', 'ACCOUNT_LOCKED', { lockedUntil: '2026-10-21T07:30:00Z' }),
    ).toContain('14:30, 21/10');
    expect(errorMessage(en.t, 'en', 'ACCOUNT_LOCKED', { lockedUntil: null })).toContain(
      'until an admin unlocks it',
    );
  });
  it('turns retry seconds into whole minutes', () => {
    expect(errorMessage(en.t, 'en', 'RATE_LIMITED', { retryAfterSeconds: 700 })).toBe(
      'Too many attempts. Try again in 12 minutes.',
    );
    expect(errorMessage(en.t, 'en', 'RATE_LIMITED', { retryAfterSeconds: 1 })).toBe(
      'Too many attempts. Try again in 1 minute.',
    );
  });
  it('picks the Firebase variant from the reason', () => {
    expect(
      errorMessage(en.t, 'en', 'FIREBASE_TOKEN_INVALID', { reason: 'EMAIL_UNVERIFIED' }),
    ).toContain("isn't verified");
    expect(errorMessage(en.t, 'en', 'FIREBASE_TOKEN_INVALID', { reason: 'PROVIDER' })).toContain(
      "isn't supported",
    );
    expect(errorMessage(en.t, 'en', 'FIREBASE_TOKEN_INVALID', { reason: 'INVALID' })).toContain(
      "Couldn't sign in",
    );
  });
  it('formats money details', () => {
    expect(errorMessage(en.t, 'en', 'ORDER_TOTAL_TOO_LOW', { minimumVnd: 15000 })).toBe(
      'Orders start at ₫15,000.',
    );
  });
  it('never shows a raw code', () => {
    expect(errorMessage(en.t, 'en', 'SOMETHING_NEW')).toBe(enErrors.UNKNOWN);
    expect(errorMessage(vi.t, 'vi', 'SOMETHING_NEW')).toBe(viErrors.UNKNOWN);
  });
});
