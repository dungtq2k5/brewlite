import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  adminUserActivityControllerLoyalty,
  adminUserActivityControllerStaffStats,
  adminUsersControllerGet,
  type AdminUserResponseDto,
  type LoyaltyResponseDto,
  type StaffStatsResponseDto,
} from '@brewlite/api-client';
import { businessDay, businessDayCount, isBusinessDay, REPORT_MAX_DAYS } from '@brewlite/contracts';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { DetailList } from '@/components/vellum/DetailList';
import { Notice } from '@/components/vellum/Notice';
import { PageHead } from '@/components/vellum/PageHead';
import { Panel, PanelHead } from '@/components/vellum/Panel';
import { Tag } from '@/components/vellum/Tag';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';
import { formatDay, formatMoment, nullableText, roleLabel, roleTone } from '@/lib/admin-format';
import { unwrap } from '@/lib/api-server';

const DAY_MS = 24 * 60 * 60_000;

const LOYALTY_KIND: Record<string, { vi: string; en: string }> = {
  EARN: { vi: 'Tích điểm', en: 'Earned' },
  EARN_REVERSED: { vi: 'Hoàn tích điểm', en: 'Earn reversed' },
  REDEEM: { vi: 'Dùng điểm', en: 'Redeemed' },
  REDEEM_RETURNED: { vi: 'Hoàn điểm', en: 'Redemption returned' },
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}) {
  const { id } = await params;
  const range = await searchParams;
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

  const isCustomer = user.role === 'CUSTOMER';
  const isStaff = user.role === 'STAFF' || user.role === 'ADMIN';
  const today = businessDay(new Date());
  const rawFrom = first(range.from).trim();
  const rawTo = first(range.to).trim();
  const from = isBusinessDay(rawFrom) ? rawFrom : shiftDay(today, -29);
  const to = isBusinessDay(rawTo) ? rawTo : today;

  let rangeError: string | null = null;
  if (isStaff) {
    if (from > to) {
      rangeError = t(
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
        'The start date must be on or before the end date.',
      );
    } else if (businessDayCount(from, to) > REPORT_MAX_DAYS) {
      rangeError = t(
        `Mỗi lần xem tối đa ${REPORT_MAX_DAYS} ngày.`,
        `A range covers at most ${REPORT_MAX_DAYS} days.`,
      );
    }
  }

  let loyalty: LoyaltyResponseDto | null = null;
  let loyaltyFailed = false;
  if (isCustomer) {
    try {
      const response = await adminUserActivityControllerLoyalty(user.id);
      loyalty = unwrap<LoyaltyResponseDto>(response.data);
    } catch {
      loyaltyFailed = true;
    }
  }

  let staffStats: StaffStatsResponseDto | null = null;
  let staffStatsFailed = false;
  if (isStaff && !rangeError) {
    try {
      const response = await adminUserActivityControllerStaffStats(user.id, { from, to });
      staffStats = unwrap<StaffStatsResponseDto>(response.data);
    } catch {
      staffStatsFailed = true;
    }
  }

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
          <>
            {isCustomer && (
              <ButtonLink href={`/admin/orders?userId=${user.id}`} size="sm">
                {t('Đơn của khách', 'Customer orders')}
              </ButtonLink>
            )}
            <ButtonLink href="/admin/users" variant="quiet" size="sm">
              ← {t('Danh sách', 'Back to list')}
            </ButtonLink>
          </>
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

      {isCustomer && (
        <Panel>
          <PanelHead
            title={t('Điểm tích lũy', 'Loyalty points')}
            action={<Tag tone="muted">{t('20 giao dịch gần nhất', 'Latest 20 entries')}</Tag>}
          />
          {loyaltyFailed ? (
            <div className="panel-body">
              <Notice tone="warning">
                {t(
                  'Không tải được điểm tích lũy của khách lúc này.',
                  'This customer’s loyalty points could not be loaded.',
                )}
              </Notice>
            </div>
          ) : loyalty ? (
            <>
              <div className="panel-body">
                <div className="figure-grid">
                  <div className="figure-cell">
                    <span className="figure">{loyalty.balance}</span>
                    <span className="figure-label">{t('Điểm hiện có', 'Balance')}</span>
                  </div>
                  <div className="figure-cell">
                    <span className="figure">{loyalty.lifetimeEarned}</span>
                    <span className="figure-label">
                      {t('Tổng điểm đã tích', 'Lifetime earned')}
                    </span>
                  </div>
                </div>
              </div>
              {loyalty.recent.length === 0 ? (
                <div className="panel-body">
                  <p className="fine">
                    {t('Khách chưa có giao dịch điểm.', 'No point entries yet.')}
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table table--stack">
                    <thead>
                      <tr>
                        <th>{t('Đơn', 'Order')}</th>
                        <th>{t('Loại', 'Kind')}</th>
                        <th className="num">{t('Điểm', 'Points')}</th>
                        <th>{t('Thời gian', 'Time')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loyalty.recent.map((entry) => {
                        const kind = LOYALTY_KIND[entry.kind];
                        return (
                          <tr key={`${entry.orderId}-${entry.kind}-${entry.at}`}>
                            <td data-label={t('Đơn', 'Order')}>
                              <Link
                                className="text-link"
                                href={`/admin/orders?orderNo=${entry.orderNo}`}
                              >
                                #{entry.orderNo}
                              </Link>
                            </td>
                            <td data-label={t('Loại', 'Kind')}>
                              {kind ? (locale === 'vi' ? kind.vi : kind.en) : entry.kind}
                            </td>
                            <td data-label={t('Điểm', 'Points')} className="num">
                              {entry.points > 0 ? '+' : ''}
                              {entry.points}
                            </td>
                            <td data-label={t('Thời gian', 'Time')}>
                              {formatMoment(entry.at, locale)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </Panel>
      )}

      {isStaff && (
        <Panel>
          <PanelHead
            title={t('Hoạt động tại quầy', 'Counter activity')}
            action={
              <Tag tone="muted">
                {formatDay(from, locale)} – {formatDay(to, locale)}
              </Tag>
            }
          />
          <form className="toolbar" action={`/admin/users/${user.id}`} method="get">
            <div className="field">
              <label htmlFor="activity-from">{t('Từ ngày', 'From')}</label>
              <input
                id="activity-from"
                className="input"
                name="from"
                type="date"
                defaultValue={from}
                max={today}
              />
            </div>
            <div className="field">
              <label htmlFor="activity-to">{t('Đến ngày', 'To')}</label>
              <input
                id="activity-to"
                className="input"
                name="to"
                type="date"
                defaultValue={to}
                max={today}
              />
            </div>
            <Button type="submit">{t('Xem hoạt động', 'Run')}</Button>
            <Link
              className="btn btn--quiet btn--sm"
              href={`/admin/users/${user.id}?from=${shiftDay(today, -6)}&to=${today}`}
            >
              {t('7 ngày', '7 days')}
            </Link>
            <Link
              className="btn btn--quiet btn--sm"
              href={`/admin/users/${user.id}?from=${shiftDay(today, -29)}&to=${today}`}
            >
              {t('30 ngày', '30 days')}
            </Link>
          </form>

          {rangeError ? (
            <div className="panel-body">
              <Notice tone="warning" role="alert">
                {rangeError}
              </Notice>
            </div>
          ) : staffStatsFailed ? (
            <div className="panel-body">
              <Notice tone="warning">
                {t(
                  'Không tải được hoạt động của nhân viên lúc này.',
                  'This staff member’s activity could not be loaded.',
                )}
              </Notice>
            </div>
          ) : staffStats ? (
            <>
              <div className="panel-body">
                <div className="figure-grid figure-grid--five">
                  <div className="figure-cell">
                    <span className="figure">{staffStats.ordersHandled}</span>
                    <span className="figure-label">{t('Đơn đã xử lý', 'Orders handled')}</span>
                  </div>
                  <div className="figure-cell">
                    <span className="figure">{staffStats.transitions.PREPARING}</span>
                    <span className="figure-label">{t('Bắt đầu pha', 'Started')}</span>
                  </div>
                  <div className="figure-cell">
                    <span className="figure">{staffStats.transitions.READY}</span>
                    <span className="figure-label">{t('Báo sẵn sàng', 'Marked ready')}</span>
                  </div>
                  <div className="figure-cell">
                    <span className="figure">{staffStats.transitions.COMPLETED}</span>
                    <span className="figure-label">{t('Hoàn tất', 'Completed')}</span>
                  </div>
                  <div className="figure-cell">
                    <span className="figure">{staffStats.transitions.CANCELLED}</span>
                    <span className="figure-label">{t('Hủy đơn', 'Cancelled')}</span>
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <p className="fine">
                  {t(
                    'Chỉ đếm thao tác trạng thái do nhân viên này thực hiện; không bao gồm doanh thu.',
                    'Counts only the status moves made by this staff member; revenue is not included.',
                  )}
                </p>
              </div>
            </>
          ) : null}
        </Panel>
      )}
    </>
  );
}
