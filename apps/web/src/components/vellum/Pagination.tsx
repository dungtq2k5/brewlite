'use client';

import Link from 'next/link';
import { useConsoleCopy } from '@/i18n/console-context';

function pageHref(basePath: string, page: number, query?: string): string {
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/**
 * Footer pagination for the admin ledger tables. The gateway list endpoints already
 * page (`page` / `pageSize`), so this only renders the controls and the count.
 */
export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  label = 'mục',
  note,
  query,
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  label?: string;
  note?: string;
  query?: string;
}) {
  const { t } = useConsoleCopy();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className="pagination" aria-label={t('Phân trang', 'Pagination')}>
      <span>
        {t(
          `Hiển thị ${from}–${to} trên ${total} ${label}`,
          `Showing ${from}–${to} of ${total} ${label}`,
        )}
        {note ? ` · ${note}` : ''}
      </span>
      <span className="pagination-actions">
        {current > 1 ? (
          <Link className="btn btn--sm" href={pageHref(basePath, current - 1, query)} rel="prev">
            {t('Trước', 'Previous')}
          </Link>
        ) : (
          <button className="btn btn--sm" type="button" disabled>
            {t('Trước', 'Previous')}
          </button>
        )}
        <span aria-current="page" style={{ alignSelf: 'center' }}>
          {t(`Trang ${current} / ${totalPages}`, `Page ${current} / ${totalPages}`)}
        </span>
        {current < totalPages ? (
          <Link className="btn btn--sm" href={pageHref(basePath, current + 1, query)} rel="next">
            {t('Sau', 'Next')}
          </Link>
        ) : (
          <button className="btn btn--sm" type="button" disabled>
            {t('Sau', 'Next')}
          </button>
        )}
      </span>
    </nav>
  );
}
