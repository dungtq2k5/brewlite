/**
 * Unsaved changes in an admin form. A dirty form registers its changed sections; while any is
 * registered, a reload or close asks the browser to confirm (`beforeunload`), and a click on an
 * in-app link is held until the person says *Leave* (`UnsavedGuard`). The browser's **Back** button
 * fires neither, so it still leaves without asking — a known gap, accepted.
 */
const dirty = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();
let snapshot: readonly string[] = [];

function publish() {
  snapshot = [...new Set([...dirty.values()].flat())];
  listeners.forEach((l) => l());
}

export const subscribeUnsaved = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getUnsaved = (): readonly string[] => snapshot;
export const getUnsavedOnServer = (): readonly string[] => [];

/** `sections` empty (or `clear`) means this form is clean. */
export function setUnsaved(key: string, sections: readonly string[]): void {
  const before = dirty.get(key);
  if (sections.length === 0) {
    if (before === undefined) return;
    dirty.delete(key);
  } else if (before === undefined || before.join() !== sections.join()) {
    dirty.set(key, [...sections]);
  } else {
    return;
  }
  publish();
}

export const clearUnsaved = (key: string) => setUnsaved(key, []);

/** The parts of a click the guard needs — a real `MouseEvent` and `<a>` satisfy it. */
export interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}
export interface AnchorLike {
  href: string;
  target: string;
  hasDownload: boolean;
}

/**
 * The address to confirm before following, or `null` when the click is not ours to guard: a modified
 * click (⌘ / Ctrl / Shift / Alt, the middle button), a link that opens elsewhere (`target`), a
 * download, another site, a click something already handled, or a link to the page you are on
 * (including a hash on it).
 */
export function guardedHref(click: ClickLike, anchor: AnchorLike, here: URL): string | null {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (anchor.hasDownload || (anchor.target !== '' && anchor.target !== '_self')) return null;
  let to: URL;
  try {
    to = new URL(anchor.href, here);
  } catch {
    return null;
  }
  if (to.origin !== here.origin) return null;
  if (to.pathname === here.pathname && to.search === here.search) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}
