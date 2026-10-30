import { notFound } from 'next/navigation';
import { adminUsersControllerGet, type AdminUserResponseDto } from '@brewlite/api-client';
import { ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
import { formatDay, formatMoment, nullableText, roleLabel, roleTone } from '@/lib/admin-format';
import { unwrap } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  let user: AdminUserResponseDto | null = null;
  let failed = false;
  try {
    const response = await adminUsersControllerGet(id);
    user = unwrap<AdminUserResponseDto>(response.data);
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404) notFound();
    failed = true;
  }

  if (failed || !user) {
    return (
      <>
        <PageHead
          title={t('Chi tiết người dùng', 'User detail')}
          meta={t('Không đọc được dữ liệu', 'Could not load the record')}
          actions={
            <ButtonLink href="/admin/users" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          }
        />
        <Notice tone="error" role="alert">
          {t(
            'Không tải được người dùng. Kiểm tra kết nối rồi thử lại.',
            'Could not load this user. Check the connection and try again.',
          )}
        </Notice>
      </>
    );
  }

  const deleted = Boolean(nullableText(user.deletedAt));
  const status = deleted
    ? t('Đã xóa', 'Deleted')
    : user.isLocked
      ? t('Đang khóa', 'Locked')
      : t('Hoạt động', 'Active');

  return (
    <>
      <PageHead
        title={user.fullName}
        meta={user.email}
        lede={t(
          'Hồ sơ tài khoản và quyền hiện tại. Thay đổi vai trò hoặc khóa tài khoản thực hiện ở danh sách.',
          'Account profile and current permissions. Role changes and locks are made from the list.',
        )}
        actions={
          <ButtonLink href="/admin/users" variant="quiet" size="sm">
            ← {t('Danh sách', 'Back to list')}
          </ButtonLink>
        }
      />

      <div className="record-grid">
        <Panel>
          <PanelHead
            title={t('Hồ sơ', 'Profile')}
            action={
              <Tag tone={deleted ? 'error' : user.isLocked ? 'warning' : 'success'}>{status}</Tag>
            }
          />
          <div className="panel-body">
            <DetailList
              rows={[
                { label: t('Họ tên', 'Full name'), value: user.fullName },
                { label: 'Email', value: user.email },
                {
                  label: t('Vai trò', 'Role'),
                  value: <Tag tone={roleTone(user.role)}>{roleLabel(user.role, locale)}</Tag>,
                },
                {
                  label: t('Ngôn ngữ', 'Locale'),
                  value:
                    user.preferredLocale === 'en'
                      ? t('Tiếng Anh', 'English')
                      : t('Tiếng Việt', 'Vietnamese'),
                },
                {
                  label: t('Mật khẩu', 'Password'),
                  value: user.hasPassword
                    ? t('Đã đặt', 'Set')
                    : t('Chưa đặt (đăng nhập Google)', 'Not set (Google sign-in)'),
                },
                {
                  label: t('Đăng nhập cuối', 'Last sign-in'),
                  value: nullableText(user.lastLoginAt)
                    ? formatMoment(nullableText(user.lastLoginAt), locale)
                    : t('Chưa có', 'Never'),
                },
                { label: t('Ngày tạo', 'Created'), value: formatDay(user.createdAt, locale) },
                {
                  label: t('Đã xóa', 'Deleted'),
                  value: nullableText(user.deletedAt)
                    ? formatMoment(nullableText(user.deletedAt), locale)
                    : '—',
                },
                {
                  label: t('Lý do khóa', 'Lock reason'),
                  value: nullableText(user.lockReason) ?? '—',
                },
                {
                  label: t('Khóa đến', 'Locked until'),
                  value: nullableText(user.lockedUntil)
                    ? formatMoment(nullableText(user.lockedUntil), locale)
                    : '—',
                },
                {
                  label: 'ID',
                  value: <span className="record-id">{user.id}</span>,
                },
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title={t('Quyền', 'Permissions')}
            action={<Tag tone="muted">{user.permissions.length}</Tag>}
          />
          <div className="panel-body">
            {user.permissions.length === 0 ? (
              <p className="muted">
                {t('Tài khoản chưa có quyền nội bộ.', 'This account has no console permissions.')}
              </p>
            ) : (
              <div className="tag-cloud">
                {user.permissions.map((permission) => (
                  <Tag key={permission} tone="muted">
                    {permission}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
