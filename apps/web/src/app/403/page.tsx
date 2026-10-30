import type { Metadata } from 'next';
import Link from 'next/link';
import LogoutButton from '@/components/LogoutButton';
import { consoleCopy } from '@/i18n/console';
import { getLocale } from '@/i18n/locale.server';

export const metadata: Metadata = {
  title: 'Không đủ quyền — BrewLite',
  robots: { index: false },
};

export default async function ForbiddenPage() {
  const locale = await getLocale();
  const { t } = consoleCopy(locale);

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div>
          <Link className="wordmark" href="/">
            BrewLite
          </Link>
          <p style={{ marginTop: 'var(--space-lg)' }}>
            {t(
              'Cà phê và trà pha theo từng ly. Đặt trước, nhận tại quầy.',
              'Coffee and tea brewed to order. Order ahead, pick up at the counter.',
            )}
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h1>{t('Không đủ quyền', 'Access denied')}</h1>
          <p className="page-meta">
            {t(
              'Tài khoản đang đăng nhập không có quyền mở trang này. Quyền được kiểm tra ở máy chủ; đổi tài khoản nếu bạn cần truy cập khu vực khác.',
              'The signed-in account is not allowed to open this page. Permissions are checked on the server; switch accounts if you need access elsewhere.',
            )}
          </p>

          <div className="notice notice--warning" style={{ marginTop: 'var(--space-md)' }}>
            {t(
              'Nếu bạn cho rằng đây là nhầm lẫn, hãy đăng xuất rồi đăng nhập lại bằng tài khoản được cấp quyền.',
              'If you believe this is a mistake, sign out and sign back in with an authorized account.',
            )}
          </div>

          <div style={{ marginTop: 'var(--space-md)', display: 'grid', gap: 'var(--space-sm)' }}>
            <Link className="btn btn--primary btn--block" href="/">
              {t('Về trang chủ', 'Back to home')}
            </Link>
            <LogoutButton
              className="btn btn--block"
              label={t('Đăng xuất', 'Sign out')}
              pendingLabel={t('Đang đăng xuất…', 'Signing out…')}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
