import { adminUsersControllerList, type AdminUserResponseDto } from '@brewlite/api-client';
import { EmptyState } from '@/components/vellum/EmptyState';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Pagination } from '@/components/vellum/Pagination';
import { Panel } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { formatDay, formatMoment, nullableText, roleLabel, roleTone } from '@/lib/admin-format';
import { readPage } from '@/lib/api-server';
import { ADMIN_PAGE_SIZE, parsePageParam } from '@/lib/pagination';

function UserStatus({ user }: { user: AdminUserResponseDto }) {
  if (nullableText(user.deletedAt)) return <Tag tone="error">Đã xóa</Tag>;
  if (user.isLocked) return <Tag tone="warning">Đang khóa</Tag>;
  return <Tag tone="success">Hoạt động</Tag>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  let pageNumber = parsePageParam((await searchParams).page);
  let rows: AdminUserResponseDto[] = [];
  let total: number | null = null;
  let failed = false;

  try {
    const load = (page: number) =>
      adminUsersControllerList({ page, pageSize: ADMIN_PAGE_SIZE, sort: '-createdAt' });

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

  return (
    <>
      <PageHead
        title="Người dùng"
        meta={failed ? 'Không đọc được dữ liệu' : `${total ?? rows.length} tài khoản`}
        lede="Danh sách đọc từ endpoint admin hiện có. P0 chỉ xem; thao tác đổi vai trò, khóa và xóa mềm chưa được nối."
      />

      {failed ? (
        <Notice tone="error">
          <strong>Không tải được người dùng.</strong> Kiểm tra kết nối tới gateway rồi tải lại
          trang.
        </Notice>
      ) : (
        <Panel>
          {rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState title="Chưa có người dùng">
                Gateway trả danh sách rỗng. Tài khoản mới sẽ xuất hiện ở đây.
              </EmptyState>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--ledger">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Đăng nhập cuối</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => {
                    const lastLogin = nullableText(user.lastLoginAt);
                    return (
                      <tr key={user.id}>
                        <td data-label="Người dùng">
                          <span className="cell-title">{user.fullName}</span>
                          <span className="cell-meta">{user.email}</span>
                        </td>
                        <td data-label="Vai trò">
                          <Tag tone={roleTone(user.role)}>{roleLabel(user.role)}</Tag>
                        </td>
                        <td data-label="Trạng thái">
                          <UserStatus user={user} />
                        </td>
                        <td data-label="Đăng nhập cuối">
                          {lastLogin ? formatMoment(lastLogin) : 'Chưa có'}
                        </td>
                        <td data-label="Ngày tạo">{formatDay(user.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(total ?? rows.length) > 0 && (
            <Pagination
              basePath="/admin/users"
              page={pageNumber}
              pageSize={ADMIN_PAGE_SIZE}
              total={total ?? rows.length}
              label="tài khoản"
            />
          )}
        </Panel>
      )}

      <p className="fine">
        Bộ lọc <code>q</code>, <code>role</code>, <code>locked</code>, <code>deleted</code> có trong
        endpoint nhưng chưa đưa lên giao diện P0.
      </p>
    </>
  );
}
