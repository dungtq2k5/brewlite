'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Section } from '@/lib/admin/product-save';

export type SaveBarState =
  | { kind: 'unsaved'; sections: readonly Section[] }
  | { kind: 'saving' }
  | { kind: 'partial'; saved: readonly Section[]; failed: readonly Section[] }
  | { kind: 'saved' };

/**
 * The sticky bar (`95:1054`): appears once anything changed and names the sections; *Discard*
 * resets everything; after a partial failure it names what saved, what did not, and offers
 * *Retry <section>* for the first failure.
 */
export function SaveBar({
  state,
  onSave,
  onDiscard,
  onRetry,
}: Readonly<{
  state: SaveBarState;
  onSave: () => void;
  onDiscard: () => void;
  onRetry: (section: Section) => void;
}>) {
  const { t } = useTranslation('admin');
  const name = (s: Section) => t(`editor.${s}`);
  const list = (sections: readonly Section[]) => sections.map(name).join(t('saveBar.and'));

  let message: string;
  if (state.kind === 'saving') message = t('saveBar.saving');
  else if (state.kind === 'saved') message = t('saveBar.saved');
  else if (state.kind === 'partial') {
    message = [
      state.saved.length > 0 ? t('saveBar.savedSome', { sections: list(state.saved) }) : '',
      t('saveBar.partial', { section: list(state.failed) }),
    ]
      .filter(Boolean)
      .join(' · ');
  } else message = t('saveBar.unsaved', { sections: list(state.sections) });

  const busy = state.kind === 'saving';
  return (
    <div className="border-base-300 bg-base-100 sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center gap-3 border-t px-6 py-3">
      <p role="status" className="flex flex-1 items-center gap-2 font-medium">
        {busy && (
          <LoaderCircle aria-hidden size={18} className="animate-spin motion-reduce:animate-none" />
        )}
        {message}
      </p>
      {state.kind === 'partial' && state.failed[0] && (
        <button
          type="button"
          className="btn btn-outline min-h-11"
          onClick={() => onRetry(state.failed[0]!)}
        >
          {t('saveBar.retry', { section: name(state.failed[0]) })}
        </button>
      )}
      {state.kind !== 'saved' && (
        <>
          <button
            type="button"
            className="btn btn-ghost min-h-11"
            disabled={busy}
            onClick={onDiscard}
          >
            {t('saveBar.discard')}
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={busy}
            onClick={onSave}
          >
            {t('saveBar.save')}
          </button>
        </>
      )}
    </div>
  );
}
