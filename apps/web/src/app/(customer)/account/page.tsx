import Link from 'next/link';
import { loyaltyControllerGetMyLoyalty, type LoyaltyResponseDto } from '@brewlite/api-client';
import LogoutButton from '@/components/LogoutButton';
import { getLocale } from '@/i18n/locale.server';
import { unwrap } from '@/lib/api-server';
import { requireUser } from '@/lib/session';
import ProfileForm from './ProfileForm';

export default async function AccountPage() {
  const [user, locale] = await Promise.all([requireUser('/account'), getLocale()]);
  const isVi = locale === 'vi';

  let loyalty: LoyaltyResponseDto | null = null;
  try {
    const response = await loyaltyControllerGetMyLoyalty();
    loyalty = unwrap<LoyaltyResponseDto>(response.data);
  } catch {
    // The profile still renders; the points card says it cannot load instead of inventing 0.
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-lg)' }}>
      <header className="page-head">
        <div>
          <h1 className="page-title">{isVi ? 'Tài khoản' : 'Account'}</h1>
          <p className="page-meta">
            {isVi
              ? 'Thông tin cá nhân và điểm tích lũy thành viên.'
              : 'Personal details and loyalty points.'}
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn--sm" href="/orders">
            {isVi ? 'Đơn của tôi' : 'My orders'}
          </Link>
        </div>
      </header>

      <div className="stack">
        <section className="panel">
          <div className="panel-body" style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div
              aria-hidden="true"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 64,
                height: 64,
                border: '1px solid var(--color-ink)',
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                flex: 'none',
              }}
            >
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-lg)' }}>
                {user.fullName}
              </h2>
              <p className="muted" style={{ overflowWrap: 'anywhere' }}>
                {user.email}
              </p>
              <p className="page-meta" style={{ marginTop: 'var(--space-2xs)' }}>
                {user.role === 'ADMIN'
                  ? isVi
                    ? 'Quản trị'
                    : 'Admin'
                  : user.role === 'STAFF'
                    ? isVi
                      ? 'Nhân viên quầy'
                      : 'Counter staff'
                    : isVi
                      ? 'Khách hàng'
                      : 'Customer'}
              </p>
            </div>
          </div>
        </section>

        <ProfileForm
          initialFullName={user.fullName}
          initialLocale={user.preferredLocale}
          labels={{
            title: isVi ? 'Thông tin cá nhân' : 'Personal details',
            lede: isVi
              ? 'Tên hiển thị trên đơn hàng và ngôn ngữ mặc định của tài khoản.'
              : 'The name shown on your orders and the account default language.',
            fullName: isVi ? 'Họ tên' : 'Full name',
            locale: isVi ? 'Ngôn ngữ' : 'Language',
            vi: 'Tiếng Việt',
            en: 'English',
            save: isVi ? 'Lưu thay đổi' : 'Save changes',
            saving: isVi ? 'Đang lưu…' : 'Saving…',
            saved: isVi ? 'Đã cập nhật thông tin.' : 'Your details were updated.',
          }}
        />

        <section className="panel">
          <div className="panel-head">
            <h2>{isVi ? 'Điểm tích lũy' : 'Loyalty points'}</h2>
            <span className="tag tag--muted">
              {isVi ? 'Từ đơn đã hoàn tất' : 'From completed orders'}
            </span>
          </div>
          <div className="panel-body">
            {loyalty ? (
              <>
                <p className="figure" style={{ fontSize: 'var(--text-figure)' }}>
                  {loyalty.balance}
                </p>
                <p className="page-meta">
                  {isVi ? 'Tổng điểm đã tích lũy' : 'Lifetime earned'}: {loyalty.lifetimeEarned}
                </p>
                {loyalty.recent.length > 0 && (
                  <ul className="account-list" style={{ marginTop: 'var(--space-md)' }}>
                    {loyalty.recent.slice(0, 5).map((row) => (
                      <li className="account-row" key={`${row.orderId}-${row.at}`}>
                        <span>#{row.orderNo}</span>
                        <span className="num">
                          {row.points > 0 ? '+' : ''}
                          {row.points}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="notice notice--warning">
                {isVi
                  ? 'Không thể tải điểm tích lũy lúc này. Vui lòng thử lại sau.'
                  : 'Loyalty points could not be loaded. Please try again later.'}
              </div>
            )}
          </div>
        </section>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <Link className="btn" href="/">
          {isVi ? 'Về thực đơn' : 'Back to menu'}
        </Link>
        <LogoutButton label={isVi ? 'Đăng xuất' : 'Sign out'} className="btn btn--danger" />
      </div>

      {user.role !== 'CUSTOMER' && (
        <aside className="p1-note">
          <strong>{isVi ? 'Bề mặt vận hành' : 'Operations surfaces'}</strong>
          <span>
            {isVi
              ? 'Tài khoản này cũng mở được bảng đơn Staff và khu quản trị Admin.'
              : 'This account also opens the Staff board and Admin console.'}
          </span>
          <span style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <Link className="text-link" href="/staff">
              Staff
            </Link>
            {user.role === 'ADMIN' && (
              <Link className="text-link" href="/admin">
                Admin
              </Link>
            )}
          </span>
        </aside>
      )}

      <p className="page-meta">
        {isVi ? 'Giá hiển thị bằng đồng Việt Nam.' : 'Prices are shown in Vietnamese dong.'}
      </p>
    </div>
  );
}
