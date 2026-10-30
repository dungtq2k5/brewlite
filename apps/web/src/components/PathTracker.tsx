'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

const PathContext = createContext<{ cameFromMenu: () => boolean } | null>(null);

/**
 * Remembers which page the customer came from, inside the customer layout. A product opened
 * from the menu returns with `router.back()` (the browser restores the scroll); one opened by a
 * link or a reload goes to `/`. An installed app has no browser back button (ADR 0032), so the
 * page needs its own.
 */
export function PathTracker({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const current = useRef(pathname);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (current.current === pathname) return;
    previous.current = current.current;
    current.current = pathname;
  }, [pathname]);

  const value = useMemo(() => ({ cameFromMenu: () => previous.current === '/' }), []);
  return <PathContext.Provider value={value}>{children}</PathContext.Provider>;
}

export function useCameFromMenu(): () => boolean {
  const value = useContext(PathContext);
  if (!value) throw new Error('useCameFromMenu needs <PathTracker>');
  return value.cameFromMenu;
}
