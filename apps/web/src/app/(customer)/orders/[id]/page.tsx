'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:23100';

const STATUS_MAP_VI: Record<string, { label: string; step: number }> = {
  PENDING: { label: 'Chờ thanh toán', step: 0 },
  PAID: { label: 'Đã thanh toán', step: 1 },
  PREPARING: { label: 'Đang pha chế', step: 2 },
  READY: { label: 'Mời nhận tại quầy', step: 3 },
  COMPLETED: { label: 'Hoàn tất', step: 4 },
  FAILED: { label: 'Thanh toán chưa thành công', step: 0 },
  CANCELLED: { label: 'Đã hủy', step: 0 },
};

const STATUS_MAP_EN: Record<string, { label: string; step: number }> = {
  PENDING: { label: 'Pending Payment', step: 0 },
  PAID: { label: 'Paid', step: 1 },
  PREPARING: { label: 'Preparing', step: 2 },
  READY: { label: 'Ready for Pickup', step: 3 },
  COMPLETED: { label: 'Completed', step: 4 },
  FAILED: { label: 'Payment Failed', step: 0 },
  CANCELLED: { label: 'Cancelled', step: 0 },
};

const LIVE_STATUSES = ['PENDING', 'PAID', 'PREPARING', 'READY'];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    }
  }, []);

  const isVi = currentLang === 'vi';
  const STATUS_MAP = isVi ? STATUS_MAP_VI : STATUS_MAP_EN;

  const fetchOrderDetail = async (silent = false) => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('brewlite_access_token') || localStorage.getItem('token') || ''
          : '';

      if (!token) {
        router.push('/login?next=/orders/' + orderId);
        return;
      }

      const res = await fetch(`${GATEWAY_URL}/api/v1/orders/${orderId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
      });

      if (res.status === 401) {
        router.push('/login?next=/orders/' + orderId);
        return;
      }

      const json = await res.json().catch(() => null);

      if (res.ok && json) {
        const orderData = json.data?.order || json.data || json.order || json;
        setOrder(orderData);
        setErrorMsg('');
      } else if (!silent) {
        setErrorMsg(
          json?.error?.message ||
            json?.message ||
            (isVi ? 'Không thể tải chi tiết đơn hàng.' : 'Failed to load order details.'),
        );
      }
    } catch {
      if (!silent) setErrorMsg(isVi ? 'Lỗi kết nối đến máy chủ.' : 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId || !order) return;
    if (!LIVE_STATUSES.includes(String(order.status || '').toUpperCase())) return;
    const timer = setInterval(() => fetchOrderDetail(true), 5000);
    return () => clearInterval(timer);
  }, [orderId, order?.status]);

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

  const currentStatus = String(order?.status || 'PENDING').toUpperCase();
  const statusInfo = STATUS_MAP[currentStatus] || { label: currentStatus, step: 0 };
  const rawNum = String(
    order?.orderNumber ||
      order?.code ||
      String(order?.id || orderId || '')
        .slice(-5)
        .toUpperCase(),
  );
  const displayOrderNum = rawNum.startsWith('#') ? rawNum : '#' + rawNum;
  const showSteps = currentStatus !== 'CANCELLED' && currentStatus !== 'FAILED';

  let hint = isVi ? 'Cảm ơn bạn đã ủng hộ BrewLite!' : 'Thank you for supporting BrewLite!';
  if (currentStatus === 'PENDING')
    hint = isVi
      ? 'Đơn đang chờ thanh toán. Hoàn tất thanh toán để quán bắt đầu pha chế.'
      : 'Pending payment. Complete payment to start preparation.';
  else if (currentStatus === 'READY')
    hint = isVi
      ? 'Lấy món tại quầy nhé — đọc số đơn cho nhân viên.'
      : 'Ready for pickup — please show your order number.';
  else if (currentStatus === 'FAILED')
    hint = isVi ? 'Thanh toán chưa thành công.' : 'Payment failed.';
  else if (currentStatus === 'CANCELLED') {
    const reason = order?.cancelReason || order?.reason;
    hint = reason
      ? (isVi ? 'Lý do: ' : 'Reason: ') + reason
      : isVi
        ? 'Đơn hàng đã được hủy.'
        : 'Order has been cancelled.';
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6 pb-28 bg-[#FDFBF9] min-h-screen">
      <div className="flex items-center justify-between border-b border-[#E8DEC8] pb-4">
        <button
          onClick={() => router.push('/orders')}
          className="text-xs font-semibold text-[#8C7E74] hover:text-[#4E3427] transition"
        >
          {isVi ? '← Quay lại' : '← Back'}
        </button>
        <h1 className="text-sm font-bold text-[#2B1E16]">
          {isVi ? 'Trạng thái đơn hàng' : 'Order Status'}
        </h1>
        <div className="w-10"></div>
      </div>

      {errorMsg && (
        <div className="bg-[#FAF0F0] border border-[#F2C0C0] text-[#C8382B] text-xs font-semibold rounded-2xl p-4">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-xs text-[#8C7E74]">
          {isVi ? 'Đang tải thông tin đơn hàng...' : 'Loading order information...'}
        </div>
      ) : !order ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm text-[#8C7E74]">
            {isVi ? 'Không tìm thấy đơn hàng này.' : 'Order not found.'}
          </p>
          <button
            onClick={() => router.push('/orders')}
            className="px-6 py-2.5 bg-[#4E3427] text-white text-xs font-bold rounded-xl shadow-xs"
          >
            {isVi ? 'Về lịch sử đơn' : 'Back to Orders'}
          </button>
        </div>
      ) : (
        <div className="space-y-6 text-center">
          {/* Số đơn */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8C7E74] tracking-wider uppercase">
              {isVi ? 'Đơn số' : 'Order No.'}
            </p>
            <div className="inline-block px-6 py-2 bg-[#4E3427] text-white text-xl font-black rounded-2xl shadow-sm">
              {displayOrderNum}
            </div>
          </div>

          {/* Biểu tượng cốc cà phê & Trạng thái */}
          <div className="py-4 space-y-3">
            <div className="flex justify-center items-center text-[#4E3427]">
              <svg
                className="w-20 h-20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                <line x1="6" y1="1" x2="6" y2="4"></line>
                <line x1="10" y1="1" x2="10" y2="4"></line>
                <line x1="14" y1="1" x2="14" y2="4"></line>
              </svg>
            </div>
            <h2 className="text-xl font-black text-[#2B1E16]">{statusInfo.label}</h2>
            <p className="text-xs text-[#8C7E74]">{hint}</p>
          </div>

          {/* Tiến trình các bước */}
          {showSteps && (
            <div className="bg-white border border-[#E8DEC8] rounded-3xl p-5 text-left space-y-4 shadow-xs">
              <div className="space-y-3">
                {[
                  { step: 1, text: isVi ? 'Đã thanh toán' : 'Paid' },
                  { step: 2, text: isVi ? 'Đang pha chế' : 'Preparing' },
                  { step: 3, text: isVi ? 'Mời nhận tại quầy' : 'Ready for Pickup' },
                  { step: 4, text: isVi ? 'Hoàn tất' : 'Completed' },
                ].map((item) => {
                  const isPassed = statusInfo.step >= item.step;
                  return (
                    <div key={item.step} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isPassed ? 'bg-[#4E3427] text-white' : 'bg-[#F5EFE6] text-[#8C7E74]'
                        }`}
                      >
                        {isPassed ? '✓' : item.step}
                      </div>
                      <span
                        className={`text-xs font-semibold ${isPassed ? 'text-[#2B1E16]' : 'text-[#8C7E74]'}`}
                      >
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Danh sách món chi tiết */}
          {order?.items && order.items.length > 0 && (
            <div className="bg-white border border-[#E8DEC8] rounded-3xl p-5 text-left space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-[#2B1E16] uppercase tracking-wider">
                {isVi ? 'Chi tiết món' : 'Order Items'}
              </h3>
              {order.items.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs border-b border-[#F5EFE6] pb-2"
                >
                  <div>
                    <span className="font-bold text-[#2B1E16]">
                      {resolveLocalizedText(item.productName || item.name)}
                    </span>
                    <span className="text-[#8C7E74] block">
                      Size: {item.size || 'M'} x {item.qty || item.quantity || 1}
                    </span>
                  </div>
                  <span className="font-bold text-[#4E3427]">
                    {Number(item.subtotalVnd || item.priceVnd || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 text-sm font-black text-[#2B1E16]">
                <span>{isVi ? 'Tổng cộng' : 'Total'}</span>
                <span className="text-[#4E3427]">
                  {Number(order.totalVnd || order.totalAmount || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          )}

          {/* Làm mới */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#8C7E74] flex items-center gap-1">
              {LIVE_STATUSES.includes(currentStatus) && (
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
              )}
              {LIVE_STATUSES.includes(currentStatus)
                ? isVi
                  ? 'Cập nhật trực tiếp'
                  : 'Live updates'
                : ''}
            </span>
            <button
              onClick={() => {
                setLoading(true);
                fetchOrderDetail();
              }}
              className="px-5 py-2 border border-[#D5C7B7] hover:bg-[#F5EFE6] text-xs font-bold text-[#4E3427] rounded-full transition"
            >
              {isVi ? 'Làm mới' : 'Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
