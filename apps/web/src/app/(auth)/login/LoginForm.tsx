'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/locale';
import { firebaseAction, loginAction, registerAction } from '@/lib/auth-actions';
import type { ActionResult } from '@/lib/action-result';
import type { AuthSuccess } from '@/lib/auth-types';
import { describeError } from '@/lib/error-messages';
import { loginWithGooglePopup } from '@/lib/firebase';
import type { ApiErrorDetails } from '@/lib/gateway-types';

type Mode = 'login' | 'register';

function detailRecord(details: unknown): ApiErrorDetails {
  return typeof details === 'object' && details !== null ? (details as ApiErrorDetails) : {};
}

export default function LoginForm({ nextPath, locale }: { nextPath: string; locale: Locale }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ code: string; details: ApiErrorDetails } | null>(null);
  const [pending, startTransition] = useTransition();
  const isVi = locale === 'vi';

  function finish(result: ActionResult<AuthSuccess>) {
    if (!result.ok) {
      setError({ code: result.code, details: detailRecord(result.details) });
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === 'login'
          ? await loginAction({ email, password, next: nextPath })
          : await registerAction({
              email,
              password,
              fullName,
              next: nextPath,
              preferredLocale: locale,
            });
      finish(result);
    });
  }

  function googleSignIn() {
    setError(null);
    startTransition(async () => {
      try {
        const idToken = await loginWithGooglePopup();
        finish(await firebaseAction(idToken, nextPath));
      } catch (cause) {
        const code =
          typeof cause === 'object' && cause !== null && 'code' in cause
            ? String(cause.code)
            : 'INTERNAL';
        setError({
          code: code === 'auth/popup-closed-by-user' ? 'FIREBASE_POPUP_CLOSED' : code,
          details: {},
        });
      }
    });
  }

  return (
    <>
      <input
        className="auth-radio"
        type="radio"
        name="auth-mode"
        id="auth-login"
        checked={mode === 'login'}
        onChange={() => {
          setMode('login');
          setError(null);
        }}
      />
      <input
        className="auth-radio"
        type="radio"
        name="auth-mode"
        id="auth-register"
        checked={mode === 'register'}
        onChange={() => {
          setMode('register');
          setError(null);
        }}
      />
      <div
        className="auth-tabs"
        role="tablist"
        aria-label={isVi ? 'Chế độ xác thực' : 'Authentication mode'}
      >
        <label htmlFor="auth-login" role="tab" aria-selected={mode === 'login'}>
          {isVi ? 'Đăng nhập' : 'Sign in'}
        </label>
        <label htmlFor="auth-register" role="tab" aria-selected={mode === 'register'}>
          {isVi ? 'Đăng ký' : 'Sign up'}
        </label>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {error && (
          <div className="notice notice--error" role="alert">
            {describeError(error.code, error.details, locale)}
          </div>
        )}

        {mode === 'register' && (
          <div className="field">
            <label htmlFor="register-name">{isVi ? 'Họ tên' : 'Full name'}</label>
            <input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={isVi ? 'Nguyễn Minh Anh' : 'Minh Anh Nguyen'}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">{isVi ? 'Mật khẩu' : 'Password'}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' && (
            <p className="field-hint">{isVi ? 'Tối thiểu 8 ký tự.' : 'At least 8 characters.'}</p>
          )}
        </div>

        <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
          {pending
            ? isVi
              ? 'Đang xử lý…'
              : 'Working…'
            : mode === 'login'
              ? isVi
                ? 'Đăng nhập'
                : 'Sign in'
              : isVi
                ? 'Tạo tài khoản'
                : 'Create account'}
        </button>
      </form>

      <div className="auth-divider" style={{ marginTop: 'var(--space-lg)' }}>
        {isVi ? 'hoặc' : 'or'}
      </div>
      <button
        className="btn btn--block"
        type="button"
        style={{ marginTop: 'var(--space-md)' }}
        onClick={googleSignIn}
        disabled={pending}
      >
        {isVi ? 'Tiếp tục với Google' : 'Continue with Google'}
      </button>
    </>
  );
}
