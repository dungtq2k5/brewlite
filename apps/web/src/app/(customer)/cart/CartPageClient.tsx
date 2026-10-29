'use client';

import Link from 'next/link';
import { MAX_QTY_PER_LINE } from '@brewlite/contracts';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { useCart } from '@/context/CartContext';
import { formatVnd, localized } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

export default function CartPageClient({ locale }: { locale: Locale }) {
  const { items, hydrated, updateQty, removeItem, previewSubtotalVnd } = useCart();
  const isVi = locale === 'vi';
  const itemCount = items.reduce((total, item) => total + item.qty, 0);

  if (!hydrated) {
    return (
      <>
        <PageHead title={isVi ? 'Giỏ hàng' : 'Cart'} />
        <p className="notice" role="status">
          {isVi ? 'Đang tải giỏ hàng…' : 'Loading the cart…'}
        </p>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <PageHead
          title={isVi ? 'Giỏ hàng' : 'Cart'}
          meta={isVi ? 'Chưa có món nào.' : 'No items yet.'}
        />
        <EmptyState
          title={isVi ? 'Giỏ hàng đang trống' : 'Your cart is empty'}
          action={
            <Link className="btn btn--primary" href="/">
              {isVi ? 'Xem thực đơn' : 'Browse the menu'}
            </Link>
          }
        >
          {isVi
            ? 'Thêm một ly cà phê hoặc trà để bắt đầu đơn hàng.'
            : 'Add a coffee or tea to start your order.'}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={isVi ? 'Giỏ hàng' : 'Cart'}
        meta={
          isVi
            ? `${itemCount} món, ${items.length} dòng. Giỏ được giữ trên thiết bị này.`
            : `${itemCount} items, ${items.length} lines. The cart stays on this device.`
        }
        actions={
          <Link className="btn btn--quiet" href="/">
            ← {isVi ? 'Chọn thêm' : 'Add more'}
          </Link>
        }
      />

      <div className="cart-layout">
        <div className="cart-lines">
          <div className="section-head">
            <h2>{isVi ? 'Món đã chọn' : 'Selected items'}</h2>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              {isVi ? 'Giá tạm tính' : 'Estimated price'}
            </span>
          </div>

          {items.map((item) => (
            <article className="cart-line" key={item.id}>
              <div>
                <h3>{localized(item.name, locale)}</h3>
                <p className="cart-line-meta">
                  Size {item.size}
                  {item.toppingNames.length > 0 && (
                    <>
                      {', '}
                      {item.toppingNames.map((name) => localized(name, locale)).join(', ')}
                    </>
                  )}
                  <br />
                  {isVi ? 'Đơn giá' : 'Unit price'} {formatVnd(item.unitPriceVnd, locale)}
                </p>
              </div>

              <div className="stepper" role="group" aria-label={isVi ? 'Số lượng' : 'Quantity'}>
                <button
                  type="button"
                  onClick={() => updateQty(item.id, -1)}
                  disabled={item.qty <= 1}
                  aria-label={isVi ? 'Giảm số lượng' : 'Decrease quantity'}
                >
                  −
                </button>
                <output>{item.qty}</output>
                <button
                  type="button"
                  onClick={() => updateQty(item.id, 1)}
                  disabled={item.qty >= MAX_QTY_PER_LINE}
                  aria-label={isVi ? 'Tăng số lượng' : 'Increase quantity'}
                >
                  +
                </button>
              </div>

              <div className="cart-line-side">
                <span className="line-total">
                  {formatVnd(item.unitPriceVnd * item.qty, locale)}
                </span>
                <button className="remove-link" type="button" onClick={() => removeItem(item.id)}>
                  {isVi ? 'Xóa' : 'Remove'}
                </button>
              </div>
            </article>
          ))}

          <p className="cart-note">
            {isVi
              ? 'Giỏ hàng được lưu trên thiết bị này. Giá cuối cùng do bước báo giá của máy chủ quyết định; nếu món hết hàng, dòng đó sẽ được đánh dấu trước khi thanh toán.'
              : 'The cart is stored on this device. The server quote sets the final price; if an item is sold out, its line is flagged before payment.'}
          </p>
        </div>

        <aside className="panel summary fibre" aria-label={isVi ? 'Tóm tắt đơn' : 'Order summary'}>
          <h2>{isVi ? 'Tóm tắt' : 'Summary'}</h2>
          <dl>
            <div className="summary-row">
              <dt>{isVi ? 'Tạm tính' : 'Subtotal'}</dt>
              <dd>{formatVnd(previewSubtotalVnd, locale)}</dd>
            </div>
            <div className="summary-row">
              <dt>{isVi ? 'Nhận tại quầy' : 'Counter pickup'}</dt>
              <dd>{isVi ? 'Miễn phí' : 'Free'}</dd>
            </div>
            <div className="summary-row summary-total">
              <dt>{isVi ? 'Tổng tạm tính' : 'Estimated total'}</dt>
              <dd>{formatVnd(previewSubtotalVnd, locale)}</dd>
            </div>
          </dl>
          <Link className="btn btn--primary btn--block" href="/checkout">
            {isVi ? 'Tiếp tục thanh toán' : 'Continue to checkout'}
          </Link>
          <p className="fine">
            {isVi
              ? 'Mã giảm giá và điểm tích lũy được nhập ở bước thanh toán. Máy chủ xác nhận giá cuối cùng.'
              : 'Promo codes and loyalty points are entered at checkout. The server confirms the final price.'}
          </p>
        </aside>
      </div>
    </>
  );
}
