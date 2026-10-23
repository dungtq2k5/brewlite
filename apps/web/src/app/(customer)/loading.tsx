import { getT } from '@/i18n/server';

export default async function Loading() {
  const { t } = await getT('common');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
      <div className="skeleton h-8 w-32" />
      <div className="skeleton h-28 w-full" />
      <div className="skeleton h-28 w-full" />
    </div>
  );
}
