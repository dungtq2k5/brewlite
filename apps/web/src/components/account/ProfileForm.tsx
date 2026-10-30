'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { FULL_NAME_MAX_LENGTH } from '@brewlite/contracts';
import { updateProfile } from '@/actions/account';
import { Alert } from '../Alert';
import { LanguageSwitch } from '../LanguageSwitch';
import { useToast } from '../Toast';

/** Name (editable), email (locked), language (the header's switch, which saves to the account). */
export function ProfileForm({ fullName, email }: Readonly<{ fullName: string; email: string }>) {
  const { t } = useTranslation('account');
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(fullName);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== fullName && name.trim() !== '';

  const save = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setFailed(false);
      const result = await updateProfile(name);
      if (!result.ok) return setFailed(true);
      router.refresh();
      toast({ message: t('profile.saved') });
    });
  };

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-4">
      <h2 id="profile-title" className="text-xl font-semibold">
        {t('profile.heading')}
      </h2>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('profile.name')}</span>
          <input
            className="input w-full"
            value={name}
            maxLength={FULL_NAME_MAX_LENGTH}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
          />
          <span className="text-base-content/70 text-sm">{t('profile.nameHelp')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t('profile.email')}</span>
          <span className="relative">
            <input
              className="input w-full pr-10"
              value={email}
              readOnly
              aria-describedby="email-note"
            />
            <Lock aria-hidden size={16} className="absolute top-1/2 right-3 -translate-y-1/2" />
          </span>
          <span id="email-note" className="text-base-content/70 text-sm">
            {t('profile.emailLocked')}
          </span>
        </label>
        {failed && <Alert type="error">{t('profile.failed')}</Alert>}
        <button type="submit" className="btn btn-primary" disabled={!dirty || pending}>
          {t('profile.save')}
        </button>
      </form>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{t('profile.language')}</p>
          <p className="text-base-content/70 text-sm">{t('profile.languageSaved')}</p>
        </div>
        <LanguageSwitch />
      </div>
    </section>
  );
}
