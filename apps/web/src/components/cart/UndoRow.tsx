'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '@/i18n/format';
import type { Locale } from '@/i18n/settings';
import type { CartLine } from '@/lib/cart/cart';

export const UNDO_MS = 5000;

/** *Removed Brown sugar milk tea · Undo*, in the removed line's place for five seconds. */
export function UndoRow({
  line,
  onUndo,
  onExpire,
}: Readonly<{ line: CartLine; onUndo: () => void; onExpire: () => void }>) {
  const { t, i18n } = useTranslation('cart');
  const name = localized(line.name, i18n.language as Locale);

  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_MS);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    // The <li> stays a list item; the live region is inside it (a role on the <li> would replace
    // `listitem`, and the list would then hold a non-item).
    <li className="my-2">
      <div
        role="status"
        className="bg-base-200 rounded-box flex min-h-14 items-center justify-between gap-3 px-4 py-2"
      >
        <span>{t('line.removed', { name })}</span>
        <button type="button" onClick={onUndo} className="min-h-11 px-2 font-semibold underline">
          {t('line.undo')}
        </button>
      </div>
    </li>
  );
}
