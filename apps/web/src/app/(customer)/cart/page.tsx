'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:23100';

export default function CartCheckoutPage() {
  const router = useRouter();
  const { items, updateQty, removeItem, clearCart, previewSubtotalVnd } = useCart();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    }
  }, []);

  const isVi = currentLang === 'vi';

  const resolveLocalizedText = (val: any, fallback = isVi ? 'Món đồ uống' : 'Beverage'): string => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return (
        val[isVi ? 'vi' : 'en'] || val.vi || val.en || Object.values(val)[0]?.toString() || fallback
      );
    }
    return String(val);
  };

  const getItemPrice = (item: any): number => {
    return Number(item.unitPriceVnd || item.priceVnd || item.basePriceVnd || item.price || 0);
  };

  const generateUUIDv7 = (): string => {
    const timestamp = Date.now();
    const high = Math.floor(timestamp / 0x100000000);
    const low = timestamp % 0x100000000;

    const timeHex = high.toString(16).padStart(8, '0') + low.toString(16).padStart(4, '0');

    const randBytes = new Uint8Array(10);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(randBytes);
    } else {
      for (let i = 0; i < 10; i++) randBytes[i] = Math.floor(Math.random() * 256);
    }

    randBytes[0] = (randBytes[0] & 0x0f) | 0x70;
    randBytes[2] = (randBytes[2] & 0x3f) | 0x80;

    const hex = Array.from(randBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return [
      timeHex.substring(0, 8),
      timeHex.substring(8, 12),
      hex.substring(0, 4),
      hex.substring(4, 8),
      hex.substring(8, 20),
    ].join('-');
  };

  const displayItems = items || [];
  const calculatedSubtotal = displayItems.reduce(
    (acc, cur: any) => acc + getItemPrice(cur) * (cur.qty || 1),
    0,
  );
  const subtotal = previewSubtotalVnd || calculatedSubtotal;
  const discount = 0;
  const totalAmount = subtotal - discount;

  const hasOutOfStock = displayItems.some((item: any) => item.outOfStock);

  const handleCheckout = async () => {
    if (hasOutOfStock || displayItems.length === 0) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('brewlite_access_token') || localStorage.getItem('token') || ''
          : '';

      if (!token) {
        router.push('/login?next=/cart');
        return;
      }

      const orderPayload = {
        items: displayItems.map((item: any) => ({
          productId: String(item.productId || item.id),
          size: String(item.size || 'M'),
          qty: Number(item.qty || item.quantity || 1),
          toppingIds: Array.isArray(item.toppingIds) ? item.toppingIds.map(String) : [],
        })),
        note: isVi ? 'Đơn hàng từ BrewLite Web' : 'Order from BrewLite Web',
      };

      const orderKey = generateUUIDv7();

      const orderRes = await fetch(`${GATEWAY_URL}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          'Idempotency-Key': orderKey,
        },
        body: JSON.stringify(orderPayload),
      });

      const orderJson = await orderRes.json().catch(() => null);

      if (!orderRes.ok || !orderJson) {
        const err =
          orderJson?.error?.message ||
          orderJson?.message ||
          (isVi ? 'Không thể tạo đơn hàng.' : 'Failed to create order.');
        setErrorMsg(err);
        setSubmitting(false);
        return;
      }

      const orderId = orderJson.data?.id || orderJson.id;

      const paymentKey = generateUUIDv7();
      const paymentRes = await fetch(`${GATEWAY_URL}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          'Idempotency-Key': paymentKey,
        },
        body: JSON.stringify({ orderId }),
      });

      const paymentJson = await paymentRes.json().catch(() => null);

      if (paymentRes.ok && paymentJson) {
        clearCart();
        router.push('/orders/' + orderId);
      } else {
        const err =
          paymentJson?.error?.message ||
          paymentJson?.message ||
          (isVi ? 'Không thể khởi tạo thanh toán.' : 'Failed to initialize payment.');
        setErrorMsg(err);
      }
    } catch (err: any) {
      setErrorMsg(
        (isVi ? 'Lỗi kết nối: ' : 'Connection error: ') + (err.message || 'Unknown error'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
        <div className="border-b border-[#E8DEC8] pb-4">
          <h1 className="text-xl font-black text-[#2B1E16]">
            {isVi ? 'Giỏ hàng & Thanh toán' : 'Cart & Checkout'}
          </h1>
        </div>
        <div className="text-center py-12 text-xs text-[#8C7E74]">
          {isVi ? 'Đang tải giỏ hàng...' : 'Loading cart...'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6 pb-28">
      <div className="flex items-center justify-between border-b border-[#E8DEC8] pb-4">
        <h1 className="text-xl font-black text-[#2B1E16]">
          {isVi ? 'Giỏ hàng & Thanh toán' : 'Cart & Checkout'}
        </h1>
        {displayItems.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs font-semibold text-[#8C7E74] hover:text-[#C8382B] transition"
          >
            {isVi ? 'Xóa giỏ hàng' : 'Clear Cart'}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-[#FAF0F0] border border-[#F2C0C0] text-[#C8382B] text-xs font-semibold rounded-2xl p-4">
          {errorMsg}
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-3xl p-10 text-center space-y-4">
          <p className="text-sm text-[#8C7E74]">
            {isVi ? 'Giỏ hàng của bạn đang trống.' : 'Your cart is currently empty.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-[#4E3427] text-white text-xs font-bold rounded-xl shadow-xs"
          >
            {isVi ? 'Xem thực đơn ngay' : 'Browse Menu'}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayItems.map((item: any) => {
              const productName = resolveLocalizedText(item.name);
              const price = getItemPrice(item);
              const qty = item.qty || 1;
              const toppingsText = Array.isArray(item.toppingNames)
                ? item.toppingNames.map((t: any) => resolveLocalizedText(t)).join(', ')
                : '';

              return (
                <div
                  key={item.id}
                  className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-[#2B1E16] truncate">{productName}</h2>
                    <div className="text-xs text-[#8C7E74] space-y-0.5">
                      <p>
                        <span className="font-semibold">Size:</span> {item.size || 'M'} ·{' '}
                        <span className="font-semibold">{isVi ? 'Đơn giá' : 'Price'}:</span>{' '}
                        {price.toLocaleString('vi-VN')} đ
                      </p>
                      {toppingsText && (
                        <p className="text-[#4E3427] font-medium text-[11px]">
                          + Toppings: {toppingsText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-[#D5C7B7] rounded-xl bg-white">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        disabled={qty <= 1}
                        className="px-2.5 py-1 text-xs font-bold text-[#4E3427] hover:bg-[#F5EFE6] rounded-l-xl disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-semibold">{qty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="px-2.5 py-1 text-xs font-bold text-[#4E3427] hover:bg-[#F5EFE6] rounded-r-xl"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-[#C8382B] hover:opacity-80 p-1 font-bold"
                      aria-label="Xóa món"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex justify-between text-xs text-[#8C7E74]">
              <span>{isVi ? 'Tạm tính' : 'Subtotal'}</span>
              <span className="font-semibold text-[#2B1E16]">
                {subtotal.toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#8C7E74]">
              <span>{isVi ? 'Giảm giá' : 'Discount'}</span>
              <span className="font-semibold text-[#2B1E16]">
                {discount.toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="border-t border-[#E8DEC8] pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-[#2B1E16]">
                {isVi ? 'Tổng thanh toán' : 'Total Amount'}
              </span>
              <span className="text-base font-black text-[#4E3427]">
                {totalAmount.toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>

          <button
            disabled={hasOutOfStock || submitting}
            onClick={handleCheckout}
            className="w-full py-3.5 bg-[#4E3427] hover:bg-[#3D281E] disabled:opacity-50 text-white font-bold rounded-2xl text-sm shadow-sm transition"
          >
            {submitting
              ? isVi
                ? 'Đang xử lý thanh toán...'
                : 'Processing payment...'
              : isVi
                ? 'Đặt đơn và thanh toán'
                : 'Place Order & Pay'}
          </button>
        </>
      )}
    </div>
  );
}
