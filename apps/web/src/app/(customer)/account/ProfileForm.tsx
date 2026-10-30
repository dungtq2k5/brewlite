'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/vellum/Button';
import { Notice } from '@/components/vellum/Notice';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { updateProfileAction } from '@/lib/profile-actions';

export default function ProfileForm({
  initialFullName,
  initialLocale,
  uiLocale,
  labels,
}: {
  initialFullName: string;
  initialLocale: 'vi' | 'en';
  uiLocale: 'vi' | 'en';
  labels: {
    title: string;
    lede: string;
    fullName: string;
    locale: string;
    vi: string;
    en: string;
    save: string;
    saving: string;
    saved: string;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [locale, setLocale] = useState<'vi' | 'en'>(initialLocale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateProfileAction({ fullName, preferredLocale: locale });
      if (!result.ok) {
        setError(describeError(result.code, result.details as ApiErrorDetails, uiLocale));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(
        uiLocale === 'vi'
          ? 'Không thể lưu lúc này. Vui lòng thử lại.'
          : 'Could not save right now. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{labels.title}</h2>
      </div>
      <div className="panel-body stack">
        <p className="page-meta">{labels.lede}</p>
        <div className="field-row">
          <div className="field">
            <label htmlFor="profile-full-name">{labels.fullName}</label>
            <input
              id="profile-full-name"
              className="input"
              value={fullName}
              maxLength={100}
              onChange={(event) => {
                setFullName(event.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="profile-locale">{labels.locale}</label>
            <select
              id="profile-locale"
              className="input"
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value as 'vi' | 'en');
                setSaved(false);
              }}
            >
              <option value="vi">{labels.vi}</option>
              <option value="en">{labels.en}</option>
            </select>
          </div>
        </div>
        {error && (
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        )}
        {saved && (
          <Notice tone="success" role="status">
            {labels.saved}
          </Notice>
        )}
        <div>
          <Button disabled={busy || fullName.trim().length === 0} onClick={() => void submit()}>
            {busy ? labels.saving : labels.save}
          </Button>
        </div>
      </div>
    </section>
  );
}
