'use client';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ORDER_NOTE_MAX_LENGTH } from '@brewlite/contracts';

/** Optional, up to 200 characters; the counter shows from 160. */
export function NoteField({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (next: string) => void }>) {
  const { t } = useTranslation('checkout');
  const id = useId();
  const nearLimit = value.length >= 160;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {t('note.label')} <span className="font-normal opacity-70">{t('note.optional')}</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={ORDER_NOTE_MAX_LENGTH}
        rows={3}
        placeholder={t('note.placeholder')}
        className="textarea w-full"
      />
      {nearLimit && (
        <p className="mt-1 text-right text-xs tabular-nums" aria-live="polite">
          {t('note.counter', { count: value.length, max: ORDER_NOTE_MAX_LENGTH })}
        </p>
      )}
    </div>
  );
}
