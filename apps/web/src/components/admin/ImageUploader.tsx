'use client';

import { ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoChoice = { kind: 'unchanged' } | { kind: 'set'; file: File } | { kind: 'clear' };

/**
 * The photo section's picker (`100:…`): checks the type and the 2 MB limit **before** anything is
 * sent, previews the chosen file in both crops (1:1 menu card, 16:10 product page) from an object
 * URL (the CSP allows `blob:`), and only records the choice — the upload happens on *Save*.
 */
export function ImageUploader({
  currentUrl,
  choice,
  onChange,
  disabled = false,
}: Readonly<{
  currentUrl: string | null;
  choice: PhotoChoice;
  onChange: (next: PhotoChoice) => void;
  disabled?: boolean;
}>) {
  const { t } = useTranslation('admin');
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const last = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (last.current) URL.revokeObjectURL(last.current);
    },
    [],
  );

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError(t('photo.wrongType'));
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) return setError(t('photo.tooBig'));
    setError(null);
    if (last.current) URL.revokeObjectURL(last.current);
    last.current = URL.createObjectURL(file);
    setPreview(last.current);
    onChange({ kind: 'set', file });
  };

  const shown = choice.kind === 'set' ? preview : choice.kind === 'clear' ? null : currentUrl;
  const btn = 'btn btn-outline min-h-11';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        {(
          [
            ['photo.menuCard', 'aspect-square w-40'],
            ['photo.productPage', 'aspect-[16/10] w-64'],
          ] as const
        ).map(([label, size]) => (
          <figure key={label} className="flex flex-col gap-1">
            <div
              className={`bg-base-200 grid place-items-center overflow-hidden rounded-lg ${size}`}
            >
              {shown ? (
                // A background, not an <img>: a blob: preview is not something next/image can optimise.
                <div
                  role="img"
                  aria-label={choice.kind === 'set' ? t('photo.alt') : ''}
                  className="size-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${shown}")` }}
                />
              ) : (
                <ImagePlus aria-hidden className="text-base-content/50" size={32} />
              )}
            </div>
            <figcaption className="text-base-content/70 text-xs">{t(label)}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-base-content/70 text-sm">{t('photo.formats')}</p>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label={t('photo.choose')}
        disabled={disabled}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {shown ? t('photo.replace') : t('photo.choose')}
        </button>
        {shown && (
          <button
            type="button"
            className={`${btn} text-error`}
            disabled={disabled}
            onClick={() => {
              setError(null);
              onChange(choice.kind === 'set' ? { kind: 'unchanged' } : { kind: 'clear' });
            }}
          >
            {choice.kind === 'set' ? t('action.cancel') : t('photo.remove')}
          </button>
        )}
      </div>
      {choice.kind === 'set' && <p className="text-sm">{t('photo.pending')}</p>}
      {choice.kind === 'clear' && <p className="text-sm">{t('photo.removing')}</p>}
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
