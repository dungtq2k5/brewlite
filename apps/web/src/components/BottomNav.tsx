'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { items } = useCart();
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    }
  }, []);

  const totalCartCount = items.reduce((acc, cur) => acc + cur.qty, 0);
  const isVi = currentLang === 'vi';

  const tabs = [
    {
      name: isVi ? 'Thực đơn' : 'Menu',
      href: '/',
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 ${active ? 'stroke-[#4E3427]' : 'stroke-[#8C7E74]'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
          />
        </svg>
      ),
    },
    {
      name: isVi ? 'Giỏ hàng' : 'Cart',
      href: '/cart',
      badge: mounted && totalCartCount > 0 ? totalCartCount : null,
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 ${active ? 'stroke-[#4E3427]' : 'stroke-[#8C7E74]'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      name: isVi ? 'Đơn hàng' : 'Orders',
      href: '/orders',
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 ${active ? 'stroke-[#4E3427]' : 'stroke-[#8C7E74]'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      name: isVi ? 'Tài khoản' : 'Account',
      href: '/account',
      icon: (active: boolean) => (
        <svg
          className={`w-5 h-5 ${active ? 'stroke-[#4E3427]' : 'stroke-[#8C7E74]'}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#F5EFE6] border-t border-[#E8DEC8] px-4 py-2">
      <div className="max-w-md mx-auto flex justify-between items-center">
        {tabs.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 relative px-3 py-1 text-[11px] font-semibold transition ${
                isActive ? 'text-[#2B1E16] font-bold' : 'text-[#8C7E74] hover:text-[#4E3427]'
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-[#C8382B] text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
