'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getUnsaved, getUnsavedOnServer, guardedHref, subscribeUnsaved } from '@/lib/admin/unsaved';
import { AdminConfirmDialog } from './AdminConfirmDialog';

/**
 * Mounted once in the admin shell. While a form is dirty: `beforeunload` for reloads and closes,
 * and a **capturing** click listener on in-app links that calls `preventDefault()` (Next's `<Link>`
 * then does nothing — it checks `defaultPrevented`), asks *Leave without saving?* and, on *Leave*,
 * navigates itself. The browser's Back button fires neither — known and accepted.
 */
export function UnsavedGuard() {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const sections = useSyncExternalStore(subscribeUnsaved, getUnsaved, getUnsavedOnServer);
  const [pending, setPending] = useState<string | null>(null);
  const dirty = sections.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault(); // the browser shows its own prompt
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = guardedHref(
        event,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute('download') },
        new URL(window.location.href),
      );
      if (!href) return;
      event.preventDefault();
      setPending(href);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  if (!pending) return null;
  return (
    <AdminConfirmDialog
      title={t('leave.title')}
      body={t('leave.body', {
        sections: sections.map((s) => t(`editor.${s}`, { defaultValue: s })).join(t('saveBar.and')),
      })}
      confirmLabel={t('leave.leave')}
      keepLabel={t('leave.keep')}
      onConfirm={() => {
        const to = pending;
        setPending(null);
        router.push(to);
      }}
      onClose={() => setPending(null)}
    />
  );
}
