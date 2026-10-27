'use client';

import type { LocalizedText } from '@/i18n/format';
import { useLocale } from '@/i18n/locale-context';

interface LocalizedInputProps {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  required?: boolean;
}

export function LocalizedInput({
  label,
  value,
  onChange,
  required = true,
}: LocalizedInputProps) {
  const { tx } = useLocale();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <fieldset className="fieldset">
        <legend className="fieldset-legend font-bold text-[#4E311E]">
          {label} ({tx('Tiếng Việt - VI', 'Vietnamese - VI')})
        </legend>
        <input
          type="text"
          className="input input-bordered w-full bg-[#F3ECE1] border-[#9B7B60]"
          placeholder={tx('Nhập nội dung tiếng Việt...', 'Enter Vietnamese text...')}
          value={value.vi}
          required={required}
          onChange={(e) => onChange({ ...value, vi: e.target.value })}
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="fieldset-legend font-bold text-[#4E311E]">
          {label} ({tx('Tiếng Anh - EN', 'English - EN')})
        </legend>
        <input
          type="text"
          className="input input-bordered w-full bg-[#F3ECE1] border-[#9B7B60]"
          placeholder={tx('Nhập nội dung tiếng Anh...', 'Enter English text...')}
          value={value.en}
          required={required}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
        />
      </fieldset>
    </div>
  );
}