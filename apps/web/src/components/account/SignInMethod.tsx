import { KeyRound } from 'lucide-react';
import { getT } from '@/i18n/server';

/** How this account signs in — read-only; a password change is a later feature. */
export async function SignInMethod({ hasPassword }: Readonly<{ hasPassword: boolean }>) {
  const { t } = await getT('account');
  return (
    <section aria-labelledby="signin-title" className="flex flex-col gap-2">
      <h2 id="signin-title" className="text-xl font-semibold">
        {t('signIn.heading')}
      </h2>
      <p className="flex items-center gap-2">
        <KeyRound aria-hidden size={18} />
        {t(hasPassword ? 'signIn.password' : 'signIn.google')}
      </p>
      <p className="text-base-content/70 text-sm">{t('signIn.later')}</p>
    </section>
  );
}
