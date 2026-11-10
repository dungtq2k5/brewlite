'use client';

import { KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { changePassword } from '@/actions/account';
import { errorMessage } from '@/i18n/error-message';
import type { Locale } from '@/i18n/settings';
import { validateNewPassword } from '@/lib/validate-auth';
import { Alert } from '../Alert';
import { FormField } from '../FormField';

type Done = 'changed' | 'setDone' | null;

/**
 * *Sign-in* (`116:2207`): how this account signs in and one button — *Change password*, or *Set a
 * password* for a Google-only account. The form opens in place; *Cancel* closes it; success collapses
 * it with a line, and a refresh flips `hasPassword` so the list and the button follow. Both methods
 * are listed when both apply — a Google account that set a password signs in either way.
 */
export function SignInMethod({
  hasPassword,
  signsInWithGoogle,
}: Readonly<{ hasPassword: boolean; signsInWithGoogle: boolean }>) {
  const { t, i18n } = useTranslation(['account', 'auth', 'errors']);
  const locale = i18n.language as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [pending, setPending] = useState(false);
  const [filled, setFilled] = useState({ current: false, next: false });
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [formKey, setFormKey] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  // Whether this account had a password when the form opened — the success line depends on it.
  const hadPassword = useRef(hasPassword);

  const ready = filled.next && (!hasPassword || filled.current);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = hasPassword ? String(data.get('currentPassword') ?? '') : undefined;
    const newPassword = String(data.get('newPassword') ?? '');
    const found: typeof errors = {};
    if (hasPassword && currentPassword === '') found.current = t('signIn.currentEmpty');
    const rule = validateNewPassword(newPassword);
    if (rule) found.next = t(`auth:validation.${rule}`);
    setErrors(found);
    if (found.current || found.next) return;

    setPending(true);
    const result = await changePassword({ currentPassword, newPassword });
    setPending(false);
    if (result.ok) {
      setDone(hadPassword.current ? 'changed' : 'setDone');
      setOpen(false);
      setFormKey((k) => k + 1);
      router.refresh(); // `hasPassword` flips for a Google-only account
      return;
    }
    if (result.code === 'CURRENT_PASSWORD_INCORRECT') {
      // The new password stays typed — only the current one was wrong.
      setErrors({ current: t('signIn.incorrect') });
      return;
    }
    setErrors({ form: errorMessage(t, locale, result.code, result.details) });
  };

  const close = () => {
    setOpen(false);
    setErrors({});
    setFilled({ current: false, next: false });
    setFormKey((k) => k + 1);
  };

  return (
    <section aria-labelledby="signin-title" className="flex flex-col gap-3">
      <h2 id="signin-title" className="text-xl font-semibold">
        {t('signIn.heading')}
      </h2>
      <ul className="flex flex-col gap-1">
        {signsInWithGoogle && (
          <li className="flex items-center gap-2">
            <KeyRound aria-hidden size={18} />
            {t('signIn.google')}
          </li>
        )}
        {hasPassword && (
          <li className="flex items-center gap-2">
            <KeyRound aria-hidden size={18} />
            {t('signIn.password')}
          </li>
        )}
      </ul>
      {done && <Alert type="success">{t(`signIn.${done}`)}</Alert>}

      {!open ? (
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            className="btn btn-outline min-h-11"
            onClick={() => {
              hadPassword.current = hasPassword;
              setDone(null);
              setOpen(true);
            }}
          >
            {hasPassword ? t('signIn.change') : t('signIn.set')}
          </button>
          {!hasPassword && <p className="text-base-content/70 text-sm">{t('signIn.setHint')}</p>}
        </div>
      ) : (
        <form
          key={formKey}
          ref={form}
          noValidate
          onSubmit={(e) => void submit(e)}
          className="border-base-300 rounded-box flex flex-col gap-3 border p-4"
        >
          {hasPassword && (
            <FormField
              name="currentPassword"
              type="password"
              label={t('signIn.current')}
              autoComplete="current-password"
              error={errors.current}
              onChange={(e) => setFilled((f) => ({ ...f, current: e.target.value !== '' }))}
            />
          )}
          <FormField
            name="newPassword"
            type="password"
            label={t('signIn.new')}
            autoComplete="new-password"
            help={t('signIn.newHelp')}
            error={errors.next}
            onChange={(e) => setFilled((f) => ({ ...f, next: e.target.value !== '' }))}
          />
          {errors.form && <Alert type="error">{errors.form}</Alert>}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary min-h-11" disabled={!ready || pending}>
              {pending
                ? t('signIn.saving')
                : hasPassword
                  ? t('signIn.update')
                  : t('signIn.setSubmit')}
            </button>
            <button type="button" className="btn btn-ghost min-h-11" onClick={close}>
              {t('signIn.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
