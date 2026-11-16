import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearUnsaved,
  getUnsaved,
  getUnsavedOnServer,
  guardedHref,
  setUnsaved,
  subscribeUnsaved,
  type AnchorLike,
  type ClickLike,
} from './unsaved';

afterEach(() => {
  clearUnsaved('a');
  clearUnsaved('b');
});

describe('the unsaved store', () => {
  it('holds the changed sections and goes empty when the form is clean', () => {
    setUnsaved('a', ['basics', 'sizes']);
    expect(getUnsaved()).toEqual(['basics', 'sizes']);
    setUnsaved('a', []);
    expect(getUnsaved()).toEqual([]);
  });

  it('merges two forms and drops a section once, not twice', () => {
    setUnsaved('a', ['basics']);
    setUnsaved('b', ['basics', 'photo']);
    expect(getUnsaved()).toEqual(['basics', 'photo']);
  });

  it('tells subscribers once per real change, and not for a repeat', () => {
    const seen = vi.fn();
    const stop = subscribeUnsaved(seen);
    setUnsaved('a', ['basics']);
    setUnsaved('a', ['basics']);
    setUnsaved('a', ['basics', 'sizes']);
    clearUnsaved('a');
    clearUnsaved('a');
    stop();
    expect(seen).toHaveBeenCalledTimes(3);
  });
});

describe('guardedHref', () => {
  const here = new URL('https://shop.test/admin/products/42');
  const click = (over: Partial<ClickLike> = {}): ClickLike => ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...over,
  });
  const link = (href: string, over: Partial<AnchorLike> = {}): AnchorLike => ({
    href,
    target: '',
    hasDownload: false,
    ...over,
  });

  it('guards a plain click on an in-app link and answers its address', () => {
    expect(guardedHref(click(), link('https://shop.test/admin/orders?status=PAID#top'), here)).toBe(
      '/admin/orders?status=PAID#top',
    );
    expect(guardedHref(click(), link('/admin/orders'), here)).toBe('/admin/orders');
  });

  it.each([
    ['⌘-click', click({ metaKey: true })],
    ['Ctrl-click', click({ ctrlKey: true })],
    ['Shift-click', click({ shiftKey: true })],
    ['Alt-click', click({ altKey: true })],
    ['the middle button', click({ button: 1 })],
    ['a click already handled', click({ defaultPrevented: true })],
  ])('leaves alone %s', (_n, event) => {
    expect(guardedHref(event, link('/admin/orders'), here)).toBeNull();
  });

  it('leaves alone a new-tab link, a download, another site and the page you are on', () => {
    expect(guardedHref(click(), link('/admin/orders', { target: '_blank' }), here)).toBeNull();
    expect(guardedHref(click(), link('/admin/orders', { hasDownload: true }), here)).toBeNull();
    expect(guardedHref(click(), link('https://elsewhere.test/'), here)).toBeNull();
    expect(guardedHref(click(), link('/admin/products/42'), here)).toBeNull();
    expect(guardedHref(click(), link('/admin/products/42#photo'), here)).toBeNull();
  });

  it('a link to the same path with another query is a different page', () => {
    expect(guardedHref(click(), link('/admin/products/42?tab=2'), here)).toBe(
      '/admin/products/42?tab=2',
    );
  });

  it('treats target _self as a plain link', () => {
    expect(guardedHref(click(), link('/admin/orders', { target: '_self' }), here)).toBe(
      '/admin/orders',
    );
  });
});

describe('snapshots are stable references (useSyncExternalStore compares with Object.is)', () => {
  it('the server snapshot is one array, and a clean client snapshot is that same one', () => {
    expect(getUnsavedOnServer()).toBe(getUnsavedOnServer());
    expect(getUnsaved()).toBe(getUnsavedOnServer());
    setUnsaved('a', ['basics']);
    clearUnsaved('a');
    expect(getUnsaved()).toBe(getUnsavedOnServer());
  });
  it('the client snapshot changes only when the sections do', () => {
    setUnsaved('a', ['prices']);
    const dirty = getUnsaved();
    expect(getUnsaved()).toBe(dirty);
    setUnsaved('a', ['prices']); // the same sections — no new snapshot
    expect(getUnsaved()).toBe(dirty);
    setUnsaved('a', ['prices', 'photo']);
    expect(getUnsaved()).not.toBe(dirty);
    expect(getUnsaved()).toEqual(['prices', 'photo']);
  });
});
