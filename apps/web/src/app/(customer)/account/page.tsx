'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:23100';

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    // Đọc ngôn ngữ từ localStorage giống hệt Header
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    }

    const fetchAccountData = async () => {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('brewlite_access_token') || localStorage.getItem('token') || ''
            : '';

        if (!token) {
          router.push('/login?next=/account');
          return;
        }

        const [userRes, loyaltyRes] = await Promise.all([
          fetch(`${GATEWAY_URL}/api/v1/users/me`, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
          }),
          fetch(`${GATEWAY_URL}/api/v1/loyalty/me`, {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
          }),
        ]);

        if (userRes.status === 401 || loyaltyRes.status === 401) {
          router.push('/login?next=/account');
          return;
        }

        const userJson = await userRes.json().catch(() => null);
        const loyaltyJson = await loyaltyRes.json().catch(() => null);

        if (userRes.ok && userJson) {
          setProfile(userJson.data || userJson);
        }

        if (loyaltyRes.ok && loyaltyJson) {
          setLoyalty(loyaltyJson.data || loyaltyJson);
        } else {
          setLoyalty({ balance: 0, lifetimeEarned: 0, recent: [] });
        }
      } catch {
        setErrorMsg(currentLang === 'vi' ? 'Lỗi kết nối đến máy chủ.' : 'Server connection error.');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [router, currentLang]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('brewlite_access_token');
      localStorage.removeItem('token');
    }
    router.push('/login');
  };

  const isVi = currentLang === 'vi';

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-6 pb-28 bg-[#FDFBF9] min-h-screen">
      <div className="border-b border-[#E8DEC8] pb-4">
        <h1 className="text-xl font-black text-[#2B1E16]">{isVi ? 'Tài khoản' : 'Account'}</h1>
        <p className="text-xs text-[#8C7E74]">
          {isVi
            ? 'Thông tin cá nhân và điểm tích lũy thành viên'
            : 'Personal information and loyalty points'}
        </p>
      </div>

      {errorMsg && (
        <div className="bg-[#FAF0F0] border border-[#F2C0C0] text-[#C8382B] text-xs font-semibold rounded-2xl p-4">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-xs text-[#8C7E74]">
          {isVi ? 'Đang tải thông tin tài khoản...' : 'Loading account information...'}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Thông tin profile */}
          <div className="bg-white border border-[#E8DEC8] rounded-3xl p-5 flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#F5EFE6] text-[#4E3427] flex items-center justify-center text-lg font-black">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-[#2B1E16] truncate">
                {profile?.fullName || (isVi ? 'Khách hàng' : 'Customer')}
              </h2>
              <p className="text-xs text-[#8C7E74] truncate">
                {profile?.email || 'customer@brewlite.test'}
              </p>
            </div>
          </div>

          {/* Điểm tích lũy */}
          <div className="bg-[#2B1E16] text-white border border-[#2B1E16] rounded-3xl p-6 text-center space-y-2 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-[#D5C7B7] font-semibold">
              {isVi ? 'Điểm tích lũy' : 'Loyalty Points'}
            </p>
            <div className="text-4xl font-black">{loyalty?.balance ?? 0}</div>
            <p className="text-[10px] text-[#A8988B]">
              {isVi ? 'Tổng điểm đã tích lũy:' : 'Lifetime earned:'} {loyalty?.lifetimeEarned ?? 0}
            </p>
          </div>

          {/* Nút đăng xuất */}
          <button
            onClick={handleLogout}
            className="w-full py-3.5 bg-white border border-[#E8DEC8] hover:bg-[#FAF0F0] text-[#C8382B] font-bold rounded-2xl text-sm shadow-xs transition"
          >
            {isVi ? 'Đăng xuất' : 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  );
}
