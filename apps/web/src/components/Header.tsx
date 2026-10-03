'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function Header() {
  const { items } = useCart();
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang && (savedLang === 'en' || savedLang === 'vi')) {
      setCurrentLang(savedLang);
    } else {
      localStorage.setItem('brewlite_lang', 'vi');
      setCurrentLang('vi');
    }
  }, []);

  const switchLanguage = (lang: string) => {
    localStorage.setItem('brewlite_lang', lang);
    document.cookie = `bl_locale=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    setCurrentLang(lang);
    window.location.reload();
  };

  const totalQty = items.reduce((acc, cur) => acc + cur.qty, 0);

  return (
    <header className="sticky top-0 z-40 bg-[#F5EFE6]/95 backdrop-blur-sm border-b border-[#E8DEC8]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#4E3427] flex items-center justify-center text-white shadow-xs">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-black text-base tracking-tight text-[#2B1E16]">BrewLite</span>
            <span className="text-[9px] uppercase tracking-wider font-bold text-[#8C7E74]">
              Cà phê & Trà
            </span>
          </div>
        </Link>

        {/* Action Buttons & Language Switcher */}
        <div className="flex items-center gap-3">
          <div className="bg-[#4E3427] text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs select-none">
            <button
              onClick={() => switchLanguage('vi')}
              className={`transition ${currentLang === 'vi' ? 'opacity-100 font-black underline' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
            >
              VI
            </button>
            <span className="opacity-40">|</span>
            <button
              onClick={() => switchLanguage('en')}
              className={`transition ${currentLang === 'en' ? 'opacity-100 font-black underline' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
            >
              EN
            </button>
          </div>

          <Link
            href="/cart"
            className="relative p-2 text-[#4E3427] hover:bg-[#EADFCF]/50 rounded-full transition"
            aria-label="Giỏ hàng"
          >
            <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {mounted && totalQty > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#C8382B] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {totalQty}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
