import Link from 'next/link';
import {
  adminUsersControllerList,
  AdminUsersControllerListSort,
  type AdminUsersControllerListParams,
} from '@brewlite/api-client';
import { AdminTable, Td, Th } from '@/components/admin/AdminTable';
import { FilterBar } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { RoleBadge, UserStatusBadge } from '@/components/admin/UserBadges';
import { formatDay } from '@/i18n/format';
import { getT } from '@/i18n/server';
import {
  ADMIN_PAGE_SIZE,
  readChoice,
  readOptionalChoice,
  readPage,
  readSearch,
  type RawParams,
} from '@/lib/admin/list-params';
import { userStatus } from '@/lib/admin/user-status';
import { withRequestId } from '@/lib/with-request-id';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT('admin');
  return { title: t('users.title') };
}

const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
const STATUSES = ['active', 'locked', 'deactivated'] as const;
const SORTS = Object.values(AdminUsersControllerListSort);

/** `/admin/users` (`104:3764`). *Status* maps onto the API's two flags (`locked`, `deleted`). */
export default async function UsersPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawParams> }>) {
  const raw = await searchParams;
  const { t, locale } = await getT('admin');
  const page = readPage(raw);
  const q = readSearch(raw);
  const role = readOptionalChoice(raw, 'role', ROLES);
  const filter = readOptionalChoice(raw, 'status', STATUSES);
  const sort = readChoice(raw, 'sort', SORTS, '-createdAt');
  const flags: Partial<AdminUsersControllerListParams> =
    filter === 'active'
      ? { locked: 'false', deleted: 'false' }
      : filter === 'locked'
        ? { locked: 'true' }
        : filter === 'deactivated'
          ? { deleted: 'true' }
          : {};

  const res = await adminUsersControllerList({
    page,
    pageSize: ADMIN_PAGE_SIZE,
    sort,
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
    ...flags,
  }).catch((error: unknown) => {
    throw withRequestId(error);
  });
  const rows = res.status === 200 ? (res.data.data ?? []) : [];
  const total = res.status === 200 ? (res.data.meta?.total ?? 0) : 0;
  const now = new Date();
  const current: Record<string, string> = {
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
    ...(filter ? { status: filter } : {}),
    ...(sort === '-createdAt' ? {} : { sort }),
    ...(page > 1 ? { page: String(page) } : {}),
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold">{t('users.title')}</h1>
        <p className="text-base-content/80">{t('users.count', { count: total })}</p>
      </div>
      <FilterBar
        current={current}
        defaults={{ sort: '-createdAt' }}
        searchLabel={t('users.search')}
        deleted={false}
        selects={[
          {
            key: 'role',
            label: t('users.roleLabel'),
            value: role ?? '',
            options: [
              { value: '', label: t('users.roleAny') },
              ...ROLES.map((r) => ({
                value: r,
                label: t('users.roleIs', { label: t(`users.role.${r}`) }),
              })),
            ],
          },
          {
            key: 'status',
            label: t('users.statusLabel'),
            value: filter ?? '',
            options: [
              { value: '', label: t('users.statusAny') },
              ...STATUSES.map((s) => ({
                value: s,
                label: t('users.statusIs', { label: t(`users.filterStatus.${s}`) }),
              })),
            ],
          },
        ]}
        sort={{
          value: sort,
          options: SORTS.map((value) => ({ value, label: t(`users.sort.${value}`) })),
        }}
      />
      {rows.length === 0 ? (
        <div className="border-base-300 rounded-box border px-4 py-12 text-center">
          <p className="text-lg font-semibold">{t('users.none')}</p>
          <p>{t('users.noneHint')}</p>
        </div>
      ) : (
        <>
          <AdminTable caption={t('users.title')}>
            <thead>
              <tr>
                <Th>{t('users.cols.name')}</Th>
                <Th>{t('users.cols.role')}</Th>
                <Th>{t('users.cols.method')}</Th>
                <Th>{t('users.cols.status')}</Th>
                <Th className="whitespace-nowrap">{t('users.cols.last')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-semibold whitespace-nowrap underline"
                    >
                      {u.fullName}
                    </Link>
                    <span className="text-base-content/70 block max-w-64 text-sm break-all">
                      {u.email}
                    </span>
                  </Td>
                  <Td>
                    <RoleBadge role={u.role} />
                  </Td>
                  <Td className="text-sm">
                    {u.hasPassword ? t('users.method.password') : t('users.method.social')}
                  </Td>
                  <Td>
                    <UserStatusBadge status={userStatus(u, now)} />
                  </Td>
                  <Td className="text-sm whitespace-nowrap">
                    {u.lastLoginAt ? formatDay(u.lastLoginAt, locale, true) : t('users.never')}
                  </Td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <Pagination
            path="/admin/users"
            current={current}
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={total}
            defaults={{ sort: '-createdAt' }}
          />
        </>
      )}
    </div>
  );
}
