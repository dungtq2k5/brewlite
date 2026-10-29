import Link from 'next/link';
import { getLocale } from '@/i18n/locale.server';

export default async function BuyerFooter() {
  const locale = await getLocale();
  const isVi = locale === 'vi';

  return (
    <footer className="buyer-footer">
      <div className="buyer-footer-inner">
        <div>
          <p className="wordmark" style={{ fontSize: 'var(--text-lg)' }}>
            BrewLite
          </p>
          <p style={{ marginTop: 'var(--space-2xs)' }}>
            {isVi
              ? 'Cà phê và trà pha theo từng ly. Nhận tại quầy, 07:00–21:00.'
              : 'Coffee and tea made to order. Pick up at the counter, 07:00–21:00.'}
          </p>
        </div>
        <nav aria-label={isVi ? 'Liên kết chân trang' : 'Footer links'}>
          <Link href="/">{isVi ? 'Thực đơn' : 'Menu'}</Link>
          <Link href="/orders">{isVi ? 'Đơn hàng' : 'Orders'}</Link>
          <Link href="/account">{isVi ? 'Tài khoản' : 'Account'}</Link>
          <Link href="/credits">{isVi ? 'Nguồn ảnh' : 'Image credits'}</Link>
        </nav>
        <p className="credit">
          {isVi
            ? 'Thanh toán trực tuyến, nhận món tại quầy. Không giao hàng.'
            : 'Pay online, pick up at the counter. No delivery.'}
        </p>
      </div>
    </footer>
  );
}
