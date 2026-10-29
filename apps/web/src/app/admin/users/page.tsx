import { adminUsersControllerList, type AdminUserResponseDto } from '@brewlite/api-client';
import { PageHead } from '@/components/vellum/PageHead';
import { Notice } from '@/components/vellum/Notice';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';
import { requireAdmin } from '@/lib/session';
import UsersClient from './UsersClient';

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    deleted?: string | string[];
  }>;
}) {
  const [params, currentUser] = await Promise.all([searchParams, requireAdmin('/admin/users')]);
  let pageNumber = parsePageParam(params.page);
  const query = first(params.q).trim().slice(0, 100);
  const deletedOnly = first(params.deleted) === '1';

  let rows: AdminUserResponseDto[] = [];
  let total: number | null = null;
  let failed = false;

  try {
    const load = (page: number) =>
      adminUsersControllerList({
        page,
        pageSize: ADMIN_PAGE_SIZE,
        sort: '-createdAt',
        ...(query && { q: query }),
        ...(deletedOnly && { deleted: 'true' }),
      });

    let response = await load(pageNumber);
    let page = readPage<AdminUserResponseDto>(response.data);
    const totalPages = Math.max(1, Math.ceil((page.total ?? page.rows.length) / ADMIN_PAGE_SIZE));
    if (pageNumber > totalPages) {
      pageNumber = totalPages;
      response = await load(pageNumber);
      page = readPage<AdminUserResponseDto>(response.data);
    }
    rows = page.rows;
    total = page.total;
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <>
        <PageHead title="Người dùng" meta="Không đọc được dữ liệu" />
        <Notice tone="error">
          <strong>Không tải được người dùng.</strong> Kiểm tra kết nối mạng rồi tải lại trang.
        </Notice>
      </>
    );
  }

  const queryString = new URLSearchParams({
    ...(query && { q: query }),
    ...(deletedOnly && { deleted: '1' }),
  }).toString();

  return (
    <UsersClient
      rows={rows}
      total={total}
      pageNumber={pageNumber}
      currentUserId={currentUser.id}
      deletedOnly={deletedOnly}
      query={query}
      queryString={queryString}
    />
  );
}
