'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useLocale } from '@/i18n/locale-context';

export default function HomePage() {
  const { locale, setLocale, tx } = useLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#F5EFE6]">
      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] p-8 max-w-md w-full text-center space-y-6">
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-full border border-[#9B7B60] bg-[#F3ECE1] p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`px-2.5 py-1 rounded-full ${locale === 'vi' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50]'}`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 py-1 rounded-full ${locale === 'en' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50]'}`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>

        <p className="text-xs font-semibold text-[#8C6A50]">
          {tx(
            'Hệ thống Quản trị Thực đơn, Khuyến mãi & Điều phối Đơn hàng',
            'Menu, Promotions & Live Order Management System',
          )}
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/admin"
            prefetch={false}
            className="w-full py-3 rounded-full bg-[#4E311E] text-white font-bold text-sm hover:opacity-95"
          >
            {tx('Vào Hệ thống Quản trị (Admin) →', 'Enter Admin Portal →')}
          </Link>
          <Link
            href="/staff/orders"
            prefetch={false}
            className="w-full py-3 rounded-full border border-[#9B7B60] bg-[#F3ECE1] text-[#4E311E] font-bold text-sm"
          >
            {tx('Màn hình Quầy pha chế (Staff)', 'Staff Counter Live Orders')}
          </Link>
        </div>
      </div>
    </main>
  );
}