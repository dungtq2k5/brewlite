'use client';

import React, { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#F5EFE6] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-24 h-24 text-[#C48C56] flex items-center justify-center">
        <svg className="w-20 h-20 fill-current" viewBox="0 0 24 24">
          <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0012 4zm0 4c3.48 0 6.64 1.35 9 3.55L12 19.55 3 11.55A12.87 12.87 0 0112 8z" />
        </svg>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-[#2B1E16]">Bạn đang ngoại tuyến</h2>
        <p className="text-xs text-[#8C7E74]">Giỏ hàng vẫn được lưu trên thiết bị này.</p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-[#4E3427] hover:bg-[#3D281E] text-white font-bold text-sm rounded-2xl shadow-sm transition"
      >
        Thử lại
      </button>
    </div>
  );
}
