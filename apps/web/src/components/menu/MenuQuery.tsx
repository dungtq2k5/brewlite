'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface MenuQueryValue {
  query: string;
  setQuery: (q: string) => void;
  /** Registers the visible search field, so the chip bar's icon can bring it into view. */
  registerField: (el: HTMLInputElement | null) => void;
  focusField: () => void;
}

const MenuQueryContext = createContext<MenuQueryValue | null>(null);

/**
 * The menu's search query — a small client context, not the URL: a search is a moment, not a place.
 * The field, the sections and the chips all read it.
 */
export function MenuQueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [query, setQuery] = useState('');
  const fields = useRef(new Set<HTMLInputElement>());
  const registerField = useCallback((el: HTMLInputElement | null) => {
    if (el) fields.current.add(el);
  }, []);
  const focusField = useCallback(() => {
    // The field that is shown (one for phones, one in the desktop list).
    const field = [...fields.current].find((el) => el.isConnected && el.offsetParent !== null);
    if (!field) return;
    field.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    field.focus({ preventScroll: true });
  }, []);
  const value = useMemo(
    () => ({ query, setQuery, registerField, focusField }),
    [query, registerField, focusField],
  );
  return <MenuQueryContext.Provider value={value}>{children}</MenuQueryContext.Provider>;
}

/** Outside a provider (the menu not searchable): an empty query that never changes. */
export function useMenuQuery(): MenuQueryValue {
  return (
    useContext(MenuQueryContext) ?? {
      query: '',
      setQuery: () => undefined,
      registerField: () => undefined,
      focusField: () => undefined,
    }
  );
}
