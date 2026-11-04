import Link from 'next/link';
import LoginForm from './LoginForm';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { getLocale } from '@/i18n/locale.server';
import { safeNextPath } from '@/lib/navigation';

interface LoginPageProps {
  searchParams: Promise<{ next?: string; expired?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next ? safeNextPath(params.next, '') || undefined : undefined;
  const expired = params.expired === '1';
  const locale = await getLocale();
  const isVi = locale === 'vi';
  const consoleTarget = nextPath?.startsWith('/admin')
    ? isVi
      ? 'Quản trị'
      : 'Admin'
    : nextPath?.startsWith('/staff')
      ? isVi
        ? 'Quầy'
        : 'Counter'
      : null;

  if (consoleTarget) {
    return (
      <main className="auth-page auth-page--compact">
        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-topline">
              <Link className="wordmark" href="/">
                BrewLite
              </Link>
              <LocaleSwitcher locale={locale} />
            </div>
            <h1>{isVi ? 'Đăng nhập' : 'Sign in'}</h1>
            <p className="page-meta">
              <span className="auth-context">{consoleTarget}</span>{' '}
              {isVi ? 'Dùng tài khoản nội bộ để tiếp tục.' : 'Use your staff account to continue.'}
            </p>
            <LoginForm nextPath={nextPath} locale={locale} consoleOnly expired={expired} />
            <p className="auth-footer">
              <Link className="text-link" href="/">
                {isVi ? 'Về cửa hàng' : 'Back to store'}
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div>
          <Link className="wordmark" href="/">
            BrewLite
          </Link>
          <p style={{ marginTop: 'var(--space-lg)' }}>
            {isVi
              ? 'Một tài khoản để giữ giỏ hàng, theo dõi đơn và nhận điểm tích lũy tại quầy.'
              : 'One account keeps your cart, tracks your order, and collects loyalty points at the counter.'}
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-topline">
            <span className="auth-context">{isVi ? 'Khách hàng' : 'Customer'}</span>
            <LocaleSwitcher locale={locale} />
          </div>
          <h1>{isVi ? 'Đăng nhập' : 'Sign in'}</h1>
          <p className="page-meta">
            {isVi
              ? 'Khách hàng BrewLite. Dùng email và mật khẩu của bạn.'
              : 'BrewLite customer. Use your email and password.'}
          </p>
          <LoginForm nextPath={nextPath} locale={locale} expired={expired} />
          <p className="auth-footer">
            <Link className="text-link" href="/">
              {isVi ? 'Về thực đơn' : 'Back to menu'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
