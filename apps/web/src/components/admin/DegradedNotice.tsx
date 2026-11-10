import { Info } from 'lucide-react';
import { getT } from '@/i18n/server';

/** A quiet grey notice where data is missing because a peer service is down (`96:1021`). */
export async function DegradedNotice({ kind }: Readonly<{ kind: 'payments' | 'names' }>) {
  const { t } = await getT('admin');
  return (
    <p
      role="status"
      className="bg-base-200 text-base-content/80 rounded-box flex items-start gap-2 px-4 py-3 text-sm"
    >
      <Info aria-hidden size={18} className="mt-0.5 shrink-0" />
      {kind === 'payments' ? t('orders.degradedPayments') : t('orders.degradedNames')}
    </p>
  );
}
