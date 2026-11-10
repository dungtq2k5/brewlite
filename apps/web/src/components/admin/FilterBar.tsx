'use client';

import { Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hrefWith } from '@/lib/admin/list-params';

export interface FilterSelect {
  key: string;
  /** Shown on the control, e.g. *Category: All*. */
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
}

/**
 * Search, selects, the *Deleted* chip, sort and *Clear filters* (`96:920`). It only edits the
 * address (`router.replace`); the page is a Server Component that reads it, so a reload, the back
 * button and a shared link all keep the filters. Search waits 300 ms after the last keystroke.
 */
export function FilterBar({
  current,
  defaults = {},
  search = true,
  searchLabel,
  toggles = [],
  selects = [],
  deleted = true,
  sort,
}: Readonly<{
  current: Record<string, string>;
  defaults?: Record<string, string>;
  search?: boolean;
  /** The search box's words, when it is not a *name* search. */
  searchLabel?: string;
  /** Extra on/off chips (`?key=true`), e.g. *Active only*. */
  toggles?: readonly { key: string; label: string; on: boolean }[];
  selects?: readonly FilterSelect[];
  deleted?: boolean;
  sort?: { value: string; options: readonly { value: string; label: string }[] };
}>) {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const path = usePathname();
  const [text, setText] = useState(current.q ?? '');

  const go = (patch: Record<string, string | undefined>) =>
    router.replace(hrefWith(path, current, patch, defaults));

  // Search waits 300 ms after the last keystroke; each keystroke restarts the wait.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const typeSearch = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value.trim() !== (current.q ?? '')) go({ q: value.trim() });
    }, 300);
  };

  const isDeleted = current.deleted === 'true';
  const filtered =
    Boolean(current.q) ||
    isDeleted ||
    toggles.some((x) => x.on) ||
    selects.some((s) => s.value !== '') ||
    (sort ? sort.value !== (defaults.sort ?? sort.options[0]?.value) : false);

  const chip = 'rounded-full border px-4 min-h-11 text-sm font-medium';
  return (
    <div className="flex flex-wrap items-center gap-3">
      {search && (
        <label className="relative">
          <span className="sr-only">{searchLabel ?? t('list.search')}</span>
          <Search
            aria-hidden
            size={18}
            className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2"
          />
          <input
            type="search"
            value={text}
            placeholder={searchLabel ?? t('list.search')}
            onChange={(e) => typeSearch(e.target.value)}
            className="input min-h-11 w-64 rounded-full pl-10"
          />
        </label>
      )}
      {selects.map((select) => (
        <label key={select.key} className="relative">
          <span className="sr-only">{select.label}</span>
          <select
            value={select.value}
            onChange={(e) => go({ [select.key]: e.target.value })}
            className="select min-h-11 rounded-full"
          >
            {select.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {toggles.map((toggle) => (
        <button
          key={toggle.key}
          type="button"
          aria-pressed={toggle.on}
          onClick={() => go({ [toggle.key]: toggle.on ? undefined : 'true' })}
          className={`${chip} ${toggle.on ? 'bg-neutral text-neutral-content border-neutral' : 'border-base-300'}`}
        >
          {toggle.label}
        </button>
      ))}
      {deleted && (
        <button
          type="button"
          aria-pressed={isDeleted}
          onClick={() => go({ deleted: isDeleted ? undefined : 'true' })}
          className={`${chip} ${isDeleted ? 'bg-neutral text-neutral-content border-neutral' : 'border-base-300'}`}
        >
          {t('list.deleted')}
        </button>
      )}
      {filtered && (
        <button
          type="button"
          className="min-h-11 text-sm font-medium underline"
          onClick={() => router.replace(path)}
        >
          {t('list.clear')}
        </button>
      )}
      {sort && (
        <label className="ml-auto">
          <span className="sr-only">{t('list.sortLabel', { label: '' })}</span>
          <select
            value={sort.value}
            onChange={(e) => go({ sort: e.target.value })}
            className="select min-h-11 rounded-full"
          >
            {sort.options.map((o) => (
              <option key={o.value} value={o.value}>
                {t('list.sortLabel', { label: o.label })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
