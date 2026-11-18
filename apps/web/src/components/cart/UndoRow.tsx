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
    <li className="border-base-300 border-b py-2.5">
      <div role="status" className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[15px] leading-[22px] opacity-75">
          {t('line.removed', { name })}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="text-primary h-11 shrink-0 px-3 text-[15px] leading-[22px] font-semibold whitespace-nowrap underline"
        >
          {t('line.undo')}
        </button>
      </div>
    </li>
  );
}
