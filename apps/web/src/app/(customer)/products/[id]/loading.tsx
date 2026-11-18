import { BackToMenu } from '@/components/product/BackToMenu';
import { getT } from '@/i18n/server';

/** Frame 53:3700 — the product's shape while it loads; the add bar comes with the data. */
export default async function Loading() {
  const [{ t }, { t: tm }] = await Promise.all([getT('common'), getT('menu')]);
  return (
    <div>
      <BackToMenu label={tm('product.back')} />
      <div
        role="status"
        aria-label={t('loading')}
        className="mt-5 flex flex-col gap-5 lg:mt-4 lg:grid lg:grid-cols-[35fr_32fr] lg:gap-12"
      >
        <div className="skeleton rounded-box aspect-16/10 w-full lg:aspect-4/3" />
        <div className="flex flex-col gap-5">
          <div className="skeleton h-7 w-60 rounded-md" />
          <div className="skeleton h-4 w-75 max-w-full rounded-md" />
          <div className="skeleton h-5 w-20 rounded-md" />
          <div className="flex gap-2">
            <div className="skeleton rounded-field h-18 flex-1" />
            <div className="skeleton rounded-field h-18 flex-1" />
          </div>
          <div className="skeleton rounded-field h-13 w-full" />
          <div className="skeleton rounded-field h-13 w-full" />
          <div className="skeleton rounded-field h-13 w-full" />
        </div>
      </div>
    </div>
  );
}
