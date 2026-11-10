'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn, signUp, type AuthFormState } from '@/actions/auth';
import { Alert } from './Alert';
import { FormField } from './FormField';
import { SocialButtons } from './SocialButtons';
import { useErrorMessage } from './useErrorMessage';

const initial: AuthFormState = {};

/** `/login` and `/register` share everything but the extra name field, the copy and the action. */
export function AuthForm({ mode, next }: Readonly<{ mode: 'login' | 'register'; next: string }>) {
  const { t } = useTranslation('auth');
  const message = useErrorMessage();
  const [state, action, pending] = useActionState(mode === 'login' ? signIn : signUp, initial);
  const register = mode === 'register';
  const field = (key: keyof NonNullable<AuthFormState['fieldErrors']>) => {
    const k = state.fieldErrors?.[key];
    return k ? t(`validation.${k}`) : undefined;
  };
  const otherPage = `${register ? '/login' : '/register'}${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`;
  const fromCheckout = !register && next.startsWith('/checkout');

  return (
    <div className="flex flex-col gap-4">
      {fromCheckout && <Alert type="info">{t('login.fromCheckout')}</Alert>}
      <SocialButtons next={next} />
      <div className="text-base-content/70 flex items-center gap-3 text-sm" role="separator">
        <span className="bg-base-300 h-px flex-1" />
        {t('or')}
        <span className="bg-base-300 h-px flex-1" />
      </div>
      {state.code && (
        <Alert type="error">
          {message(state.code, state.details)}
          {state.code === 'EMAIL_TAKEN' && (
            <>
              {' '}
              <Link href={otherPage} className="link font-semibold">
                {t('emailTakenAction')} →
              </Link>
            </>
          )}
        </Alert>
      )}
      <form action={action} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        {register && (
          <FormField
            name="fullName"
            label={t('register.fullName')}
            placeholder={t('register.fullNamePlaceholder')}
            autoComplete="name"
            defaultValue={state.values?.fullName}
            error={field('fullName')}
          />
        )}
        <FormField
          name="email"
          type="email"
          label={t('email')}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          defaultValue={state.values?.email}
          error={field('email')}
        />
        <FormField
          name="password"
          type="password"
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          autoComplete={register ? 'new-password' : 'current-password'}
          help={register ? t('register.passwordHelp') : undefined}
          error={field('password')}
        />
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending && <span className="loading loading-spinner" aria-hidden />}
          {t(`${mode}.${pending ? 'submitting' : 'submit'}`)}
        </button>
      </form>
      <p className="text-center">
        {t(register ? 'register.haveAccount' : 'login.newHere')}{' '}
        <Link href={otherPage} className="link text-primary font-semibold">
          {t(register ? 'register.signIn' : 'login.createAccount')}
        </Link>
      </p>
    </div>
  );
}
