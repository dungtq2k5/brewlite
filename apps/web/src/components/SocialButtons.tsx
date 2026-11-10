'use client';

import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithFirebase } from '@/actions/auth';
import { parsePublicEnv } from '@/config/env.schema';
import { firebaseAuth } from '@/lib/firebase';
import { useErrorMessage } from './useErrorMessage';
import { Alert } from './Alert';

const QUIET = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

const noop = () => () => {};
/** An installed iOS web app cannot open the Google popup reliably (ADR 0032's stated risk). */
const iosStandalone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true);

export function SocialButtons({ next }: Readonly<{ next: string }>) {
  const { t } = useTranslation('auth');
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [failure, setFailure] = useState<{ code: string; details?: unknown } | null>(null);
  const standalone = useSyncExternalStore(noop, iosStandalone, () => false);
  const apple = parsePublicEnv().NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED;
  const message = useErrorMessage();

  const run = async (kind: 'google' | 'apple') => {
    setBusy(kind);
    setFailure(null);
    try {
      const auth = firebaseAuth();
      const provider =
        kind === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
      const { user } = await signInWithPopup(auth, provider);
      const idToken = await user.getIdToken();
      await signOut(auth); // Firebase keeps no session for BrewLite (architecture §4.4).
      const result = await signInWithFirebase(idToken, next);
      // A success redirects; only a failure comes back here.
      setFailure(result);
    } catch (error) {
      if (!(error instanceof FirebaseError && QUIET.has(error.code))) {
        setFailure({ code: 'FIREBASE_TOKEN_INVALID', details: { reason: 'INVALID' } });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {failure && <Alert type="error">{message(failure.code, failure.details)}</Alert>}
      {standalone ? (
        <p className="text-sm">{t('iosStandalone')}</p>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline w-full"
            disabled={busy !== null}
            onClick={() => run('google')}
          >
            {busy === 'google' && <span className="loading loading-spinner" aria-hidden />}
            <GoogleMark />
            {t('google')}
          </button>
          <p className="text-sm">{t('linkingNotice')}</p>
        </>
      )}
      {apple && (
        <button
          type="button"
          className="btn btn-outline w-full"
          disabled={busy !== null}
          onClick={() => run('apple')}
        >
          {t('apple')}
        </button>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
