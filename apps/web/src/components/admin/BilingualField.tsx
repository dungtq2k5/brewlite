'use client';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { PairIssue } from '@/lib/admin/bilingual';

/**
 * An English / Vietnamese pair side by side (`95:859`), one `maxLength` for both, an error under
 * each language. The issues come from `checkPair` (before anything is sent); `serverErrors` are
 * what the API said (*another product already uses this English name*).
 */
export function BilingualField({
  label,
  required = false,
  max,
  kind = 'input',
  value,
  onChange,
  issues = [],
  serverErrors = {},
  noun = 'name',
}: Readonly<{
  label: string;
  required?: boolean;
  max: number;
  kind?: 'input' | 'textarea';
  value: { en: string; vi: string };
  onChange: (next: { en: string; vi: string }) => void;
  issues?: readonly PairIssue[];
  serverErrors?: { en?: string; vi?: string };
  /** Which sentence a missing language reads as: *the Vietnamese name* or *…description*. */
  noun?: 'name' | 'description';
}>) {
  const { t } = useTranslation('admin');
  const id = useId();

  const errorOf = (language: 'en' | 'vi'): string | undefined => {
    const issue = issues.find((i) => i.language === language);
    if (issue?.kind === 'tooLong') return t('bilingual.tooLong', { max: issue.max });
    if (issue?.kind === 'missing') {
      const key = `${language === 'vi' ? 'addVi' : 'addEn'}${noun === 'description' ? 'Description' : ''}`;
      return t(`bilingual.${key}`);
    }
    return serverErrors[language];
  };

  const Control = kind === 'textarea' ? 'textarea' : 'input';
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-medium">
        {label}{' '}
        <span className="text-base-content/70 text-sm font-normal">
          {required ? t('bilingual.required') : t('bilingual.optional')} ·{' '}
          {t('bilingual.upTo', { max })}
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['en', 'vi'] as const).map((language) => {
          const error = errorOf(language);
          const fieldId = `${id}-${language}`;
          return (
            <div key={language} className="flex flex-col gap-1">
              <label htmlFor={fieldId} className="text-base-content/70 text-xs font-medium">
                {t(`bilingual.${language}`)}
              </label>
              <Control
                id={fieldId}
                lang={language}
                value={value[language]}
                maxLength={max}
                rows={kind === 'textarea' ? 3 : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                onChange={(e) => onChange({ ...value, [language]: e.target.value })}
                className={`${kind === 'textarea' ? 'textarea' : 'input'} w-full ${error ? 'border-error' : ''}`}
              />
              {error && (
                <p id={`${fieldId}-error`} className="text-error text-sm">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
