import { SUPPORTED_LOCALES, type Locale } from '@/i18n/settings';

/**
 * The EN | VI pill as drawn (frame 10:80): a 38 px pill with 34 × 30 segments, inside a 44 px
 * touch box. The 44 px is a hit area, not a size: each segment's `::after` reaches the box's
 * top and bottom, so the pill stays compact and the target stays ≥ 44 px tall.
 */
export function LanguageToggle({
  locale,
  onChoose,
  disabled = false,
  groupLabel,
  nameOf,
  shortOf,
}: Readonly<{
  locale: Locale;
  onChoose: (next: Locale) => void;
  disabled?: boolean;
  groupLabel: string;
  nameOf: (locale: Locale) => string;
  shortOf: (locale: Locale) => string;
}>) {
  return (
    <div className="flex h-11 items-center">
      <div
        role="group"
        aria-label={groupLabel}
        className="bg-base-200 border-base-300 inline-flex h-[38px] items-center rounded-full border p-[3px]"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-label={nameOf(l)}
            aria-pressed={l === locale}
            disabled={disabled}
            onClick={() => onChoose(l)}
            className={`relative h-[30px] w-[34px] rounded-full text-xs font-semibold after:absolute after:-inset-y-[7px] after:inset-x-0 after:content-[''] ${
              l === locale ? 'bg-primary text-primary-content' : 'text-base-content'
            }`}
          >
            {shortOf(l)}
          </button>
        ))}
      </div>
    </div>
  );
}
