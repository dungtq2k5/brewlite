'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  help?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
}

/** Label above, help or error below (announced politely); a password gets a 44 px show/hide. */
export function FormField({ name, label, type = 'text', help, error, ...rest }: Readonly<Props>) {
  const { t } = useTranslation('common');
  const id = useId();
  const messageId = `${id}-message`;
  const [shown, setShown] = useState(false);
  const message = error ?? help;
  const isPassword = type === 'password';

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`input w-full ${isPassword ? 'pr-12' : ''} ${error ? 'input-error' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={shown ? t('form.hidePassword') : t('form.showPassword')}
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className="absolute top-0 right-0 grid h-full min-w-11 place-items-center"
          >
            {shown ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
          </button>
        )}
      </div>
      <p
        id={messageId}
        aria-live="polite"
        className={`min-h-0 text-sm ${error ? 'text-error' : ''}`}
      >
        {message}
      </p>
    </div>
  );
}
