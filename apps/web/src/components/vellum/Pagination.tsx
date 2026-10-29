import Link from 'next/link';

function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
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
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  label?: string;
  note?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className="pagination" aria-label="Phân trang">
      <span>
        Hiển thị {from}–{to} trên {total} {label}
        {note ? ` · ${note}` : ''}
      </span>
      <span className="pagination-actions">
        {current > 1 ? (
          <Link className="btn btn--sm" href={pageHref(basePath, current - 1)} rel="prev">
            Trước
          </Link>
        ) : (
          <button className="btn btn--sm" type="button" disabled>
            Trước
          </button>
        )}
        <span aria-current="page" style={{ alignSelf: 'center' }}>
          Trang {current} / {totalPages}
        </span>
        {current < totalPages ? (
          <Link className="btn btn--sm" href={pageHref(basePath, current + 1)} rel="next">
            Sau
          </Link>
        ) : (
          <button className="btn btn--sm" type="button" disabled>
            Sau
          </button>
        )}
      </span>
    </nav>
  );
}
