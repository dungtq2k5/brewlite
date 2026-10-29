import Link from 'next/link';
import LoginForm from './LoginForm';
import { getLocale } from '@/i18n/locale.server';
import { safeNextPath } from '@/lib/navigation';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next ? safeNextPath(params.next, '') || undefined : undefined;
  const locale = await getLocale();
  const isVi = locale === 'vi';

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
        <div className="auth-index" aria-label={isVi ? 'Quyền lợi tài khoản' : 'Account benefits'}>
          <div>
            <span>01</span>
            <span>
              {isVi ? 'Giỏ hàng được giữ trên thiết bị này.' : 'Your cart stays on this device.'}
            </span>
          </div>
          <div>
            <span>02</span>
            <span>
              {isVi
                ? 'Theo dõi trạng thái pha chế theo thời gian thực.'
                : 'Follow preparation status in real time.'}
            </span>
          </div>
          <div>
            <span>03</span>
            <span>
              {isVi
                ? 'Điểm tích lũy cộng sau khi đơn hoàn tất.'
                : 'Points arrive when an order completes.'}
            </span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h1>{isVi ? 'Đăng nhập' : 'Sign in'}</h1>
          <p className="page-meta">
            {isVi
              ? 'Khách hàng BrewLite. Dùng email và mật khẩu của bạn.'
              : 'BrewLite customer. Use your email and password.'}
          </p>
          <LoginForm nextPath={nextPath} locale={locale} />
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
