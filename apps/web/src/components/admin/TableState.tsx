import { Inbox, SearchX } from 'lucide-react';
import { getT } from '@/i18n/server';

/** An empty list: *none yet* (with what to do) or *nothing matches these filters* (`96:959`). */
export async function TableState({
  filtered,
  none,
  action,
}: Readonly<{ filtered: boolean; none: string; action?: React.ReactNode }>) {
  const { t } = await getT('admin');
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className="border-base-300 bg-base-100 rounded-box flex flex-col items-center gap-3 border px-4 py-12 text-center">
      <span className="bg-base-200 grid size-16 place-items-center rounded-full">
        <Icon aria-hidden size={28} />
      </span>
      <p className="text-lg font-semibold">{filtered ? t('list.state.filteredTitle') : none}</p>
      {filtered && <p>{t('list.state.filteredBody')}</p>}
      {action}
    </div>
  );
}
