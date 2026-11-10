import Link from 'next/link';
import { getT } from '@/i18n/server';
import { hrefWith, pageCount, pageRange, pageWindow } from '@/lib/admin/list-params';

/** *21–40 of 132* with *‹ Previous* and *Next ›* — links, so the page is a shareable address (`96:921`). */
export async function Pagination({
  path,
  current,
  page,
  pageSize,
  total,
  defaults,
}: Readonly<{
  path: string;
  current: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  defaults?: Record<string, string>;
}>) {
  const { t } = await getT('admin');
  const range = pageRange(page, pageSize, total);
  if (!range) return null;
  const last = pageCount(pageSize, total);
  const go = (to: number) =>
    hrefWith(path, current, { page: String(to) }, { page: '1', ...defaults });
  const button = 'btn btn-outline min-h-11';
  return (
    <nav aria-label={t('list.pages')} className="flex items-center justify-between gap-3 pt-4">
      <p className="text-base-content/70 text-sm tabular-nums">{t('list.range', range)}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={go(page - 1)} className={button} replace>
            {t('list.prev')}
          </Link>
        ) : (
          <span aria-disabled="true" className={`${button} btn-disabled`}>
            {t('list.prev')}
          </span>
        )}
        {pageWindow(page, last).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} aria-hidden className="grid min-h-11 place-items-center px-2">
              …
            </span>
          ) : n === page ? (
            <span
              key={n}
              aria-current="page"
              className={`${button} bg-primary text-primary-content pointer-events-none`}
            >
              {n}
            </span>
          ) : (
            <Link
              key={n}
              href={go(n)}
              className={button}
              replace
              aria-label={`${t('list.pages')} ${n}`}
            >
              {n}
            </Link>
          ),
        )}
        {page < last ? (
          <Link href={go(page + 1)} className={button} replace>
            {t('list.next')}
          </Link>
        ) : (
          <span aria-disabled="true" className={`${button} btn-disabled`}>
            {t('list.next')}
          </span>
        )}
      </div>
    </nav>
  );
}
