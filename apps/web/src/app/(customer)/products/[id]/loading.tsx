import { getT } from '@/i18n/server';

/** Frame 53:3700 — the product's shape while it loads. */
export default async function Loading() {
  const { t } = await getT('common');
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-12"
    >
      <div className="skeleton rounded-box aspect-[16/10] w-full lg:aspect-[4/3]" />
      <div className="flex flex-col gap-4">
        <div className="skeleton h-9 w-3/4" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  );
}
