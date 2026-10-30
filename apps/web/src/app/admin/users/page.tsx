import {
  adminUsersControllerList,
  type AdminUserResponseDto,
  type AdminUsersControllerListLocked,
  type AdminUsersControllerListRole,
} from '@brewlite/api-client';
import { PageHead } from '@/components/vellum/PageHead';
import { Notice } from '@/components/vellum/Notice';
import { readPage } from '@/lib/api-server';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
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
    role?: string | string[];
    locked?: string | string[];
  }>;
}) {
  const [params, currentUser] = await Promise.all([searchParams, requireAdmin('/admin/users')]);
  let pageNumber = parsePageParam(params.page);
  const query = first(params.q).trim().slice(0, 100);
  const deletedOnly = first(params.deleted) === '1';
  const roleParam = first(params.role).toUpperCase();
  const role: AdminUsersControllerListRole | '' =
    roleParam === 'CUSTOMER' || roleParam === 'STAFF' || roleParam === 'ADMIN' ? roleParam : '';
  const lockedParam = first(params.locked);
  const locked: AdminUsersControllerListLocked | '' =
    lockedParam === 'true' || lockedParam === 'false' ? lockedParam : '';

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
        ...(role && { role }),
        ...(locked && { locked }),
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
    const locale = await getLocale();
    const { t } = consoleCopy(locale);
    return (
      <>
        <PageHead
          title={t('Người dùng', 'Users')}
          meta={t('Không đọc được dữ liệu', 'Could not read data')}
        />
        <Notice tone="error">
          <strong>{t('Không tải được người dùng.', 'Could not load users.')}</strong>{' '}
          {t(
            'Kiểm tra kết nối mạng rồi tải lại trang.',
            'Check your connection and reload the page.',
          )}
        </Notice>
      </>
    );
  }

  const queryString = new URLSearchParams({
    ...(query && { q: query }),
    ...(role && { role }),
    ...(locked && { locked }),
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
      role={role}
      locked={locked}
      queryString={queryString}
    />
  );
}
