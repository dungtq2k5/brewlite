'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:23100';

const STATUS_UI_VI: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Chờ thanh toán', cls: 'bg-[#FFF4D6] text-[#8A6100] border-[#F0DDA0]' },
  PAID: { label: 'Đã thanh toán', cls: 'bg-[#EAF3EC] text-[#2F6B3F] border-[#C8E0CE]' },
  PREPARING: { label: 'Đang pha chế', cls: 'bg-[#F6E9D8] text-[#8A5A1F] border-[#E8D2B0]' },
  READY: { label: 'Mời nhận tại quầy', cls: 'bg-[#E4F0EC] text-[#1F5F4A] border-[#BFDCD2]' },
  COMPLETED: { label: 'Hoàn tất', cls: 'bg-[#F5EFE6] text-[#4E3427] border-[#E8DEC8]' },
  FAILED: { label: 'Chưa thanh toán', cls: 'bg-[#FAF0F0] text-[#C8382B] border-[#F2C0C0]' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-[#FAF0F0] text-[#C8382B] border-[#F2C0C0]' },
};

const STATUS_UI_EN: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending Payment', cls: 'bg-[#FFF4D6] text-[#8A6100] border-[#F0DDA0]' },
  PAID: { label: 'Paid', cls: 'bg-[#EAF3EC] text-[#2F6B3F] border-[#C8E0CE]' },
  PREPARING: { label: 'Preparing', cls: 'bg-[#F6E9D8] text-[#8A5A1F] border-[#E8D2B0]' },
  READY: { label: 'Ready for Pickup', cls: 'bg-[#E4F0EC] text-[#1F5F4A] border-[#BFDCD2]' },
  COMPLETED: { label: 'Completed', cls: 'bg-[#F5EFE6] text-[#4E3427] border-[#E8DEC8]' },
  FAILED: { label: 'Payment Failed', cls: 'bg-[#FAF0F0] text-[#C8382B] border-[#F2C0C0]' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[#FAF0F0] text-[#C8382B] border-[#F2C0C0]' },
};

export default function OrdersHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    }

    const fetchOrders = async () => {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('brewlite_access_token') || localStorage.getItem('token') || ''
            : '';

        if (!token) {
          router.push('/login?next=/orders');
          return;
        }

        const res = await fetch(`${GATEWAY_URL}/api/v1/orders/me`, {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token },
        });

        if (res.status === 401) {
          router.push('/login?next=/orders');
          return;
        }

        const json = await res.json().catch(() => null);

        if (res.ok && json) {
          const list = json.data?.items || json.data || json.items || json || [];
          setOrders(Array.isArray(list) ? list : []);
        } else {
          setErrorMsg(
            json?.error?.message ||
              (currentLang === 'vi'
                ? 'Không thể tải lịch sử đơn hàng.'
                : 'Failed to load order history.'),
          );
        }
      } catch {
        setErrorMsg(currentLang === 'vi' ? 'Lỗi kết nối đến máy chủ.' : 'Server connection error.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router, currentLang]);

  const isVi = currentLang === 'vi';
  const STATUS_UI = isVi ? STATUS_UI_VI : STATUS_UI_EN;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5 pb-28">
      <h1 className="text-xl font-black text-[#2B1E16]">
        {isVi ? 'Lịch sử đơn' : 'Order History'}
      </h1>

      {errorMsg && (
        <div className="bg-[#FAF0F0] border border-[#F2C0C0] text-[#C8382B] text-xs font-semibold rounded-2xl p-4">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-xs text-[#8C7E74]">
          {isVi ? 'Đang tải danh sách đơn hàng...' : 'Loading orders...'}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-3xl p-10 text-center space-y-4">
          <p className="text-sm text-[#8C7E74]">
            {isVi ? 'Bạn chưa có đơn hàng nào.' : "You don't have any orders yet."}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-[#4E3427] text-white text-xs font-bold rounded-xl shadow-xs"
          >
            {isVi ? 'Đặt món ngay' : 'Order Now'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any, idx: number) => {
            const rawId = String(
              order.orderNumber ||
                order.code ||
                String(order.id || idx + 1)
                  .slice(-5)
                  .toUpperCase(),
            );
            const displayId = rawId.startsWith('#') ? rawId : '#' + rawId;
            const status = String(order.status || 'PENDING').toUpperCase();
            const ui = STATUS_UI[status] || {
              label: status,
              cls: 'bg-[#F5EFE6] text-[#4E3427] border-[#E8DEC8]',
            };
            const total = Number(order.totalVnd || order.totalAmount || order.amount || 0);
            const itemCount = Array.isArray(order.items)
              ? order.items.reduce((s: number, i: any) => s + Number(i.qty || i.quantity || 1), 0)
              : 0;

            return (
              <div
                key={order.id || idx}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs cursor-pointer hover:border-[#4E3427] transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-black text-[#2B1E16]">{displayId}</div>
                  <p className="text-xs text-[#8C7E74]">
                    {itemCount > 0 ? `${itemCount} ${isVi ? 'ly' : 'items'} · ` : ''}
                    {total.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border font-bold ${ui.cls}`}
                >
                  {ui.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
