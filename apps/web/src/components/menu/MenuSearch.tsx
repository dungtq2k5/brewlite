'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenuQuery } from './MenuQuery';

// From `lg` the field heads the desktop list and its placeholder is the short form (D09); its
// accessible name stays the label.
const DESKTOP = '(min-width: 1024px)';
const subscribeDesktop = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isDesktop = () => window.matchMedia(DESKTOP).matches;

/**
 * *Search the menu* (`113:1016`): a search landmark with a clear button while typing, and the
 * result count announced politely after a short pause — never on every keystroke.
 */
export function MenuSearch({
  count,
  className = '',
}: Readonly<{ count: number; className?: string }>) {
  const { t } = useTranslation('menu');
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => false);
  const { query, setQuery, registerField } = useMenuQuery();
  const id = useId();
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div role="search" aria-label={t('search.label')} className={className}>
      <label htmlFor={id} className="sr-only">
        {t('search.label')}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          size={20}
          className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2"
        />
        <input
          ref={registerField}
          id={id}
          type="search"
          value={query}
          placeholder={t(desktop ? 'search.placeholderShort' : 'search.label')}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          className="input border-base-300 focus:border-primary min-h-12 w-full rounded-full pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden"
        />
        {query !== '' && (
          <button
            type="button"
            aria-label={t('search.clear')}
            onClick={() => setQuery('')}
            className="bg-base-200 absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full"
          >
            <X aria-hidden size={18} />
          </button>
        )}
      </div>
      {/* Read out at every width; seen only on a phone — the desktop frames draw no count. Empty,
          it takes no room (the frames draw the field 28 px above the first section). */}
      <p
        aria-live="polite"
        className="text-base-content/70 mt-7 min-h-5 text-sm font-medium empty:mt-0 empty:min-h-0 lg:sr-only"
      >
        {settled.trim() !== '' && count > 0 ? t('search.results', { count }) : ''}
      </p>
    </div>
  );
}
