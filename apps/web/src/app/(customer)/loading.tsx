import { getT } from '@/i18n/server';

/** The menu's shape while the two public calls are in flight (frame 51:2179). */
export default async function Loading() {
  const { t } = await getT('common');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-4">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="skeleton h-8 w-32" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className="skeleton rounded-box aspect-square w-full" />
            <div className="skeleton mt-2 h-4 w-3/4" />
            <div className="skeleton mt-1 h-4 w-1/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
