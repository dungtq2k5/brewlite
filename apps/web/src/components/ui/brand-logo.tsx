'use client';

import { useLocale } from '@/i18n/locale-context';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
}

export function BrandLogo({ size = 'md', showBadge = false }: BrandLogoProps) {
  const { tx } = useLocale();

  const iconSize = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const titleSize =
    size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg sm:text-xl' : 'text-2xl';
  const subSize = size === 'lg' ? 'text-sm' : 'text-[10px] sm:text-xs';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      {/* Biểu tượng Tách cà phê trong vòng tròn viền nâu chuẩn hình mẫu */}
      <svg
        viewBox="0 0 64 64"
        className={`${iconSize} shrink-0`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BrewLite Logo"
      >
        {/* Vòng tròn nền kem viền nâu đậm */}
        <circle cx="32" cy="32" r="29" fill="#FCF9F2" stroke="#4E311E" strokeWidth="3.2" />

        {/* Hai làn khói uốn lượn phía trên */}
        <path
          d="M27.5 22C26.2 19.2 29.2 17.2 27.8 14.2"
          stroke="#4E311E"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M34.5 22C33.2 19.2 36.2 17.2 34.8 14.2"
          stroke="#4E311E"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Quai tách chữ D bên phải */}
        <path
          d="M41.5 29.5H44.5C46.9853 29.5 49 31.5147 49 34C49 36.4853 46.9853 38.5 44.5 38.5H41"
          stroke="#4E311E"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Thân tách màu nâu cà phê */}
        <path
          d="M19 27.5H42V34.5C42 40.5751 36.8513 45 30.5 45C24.1487 45 19 40.5751 19 34.5V27.5Z"
          fill="#7D5A41"
          stroke="#4E311E"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Viền miệng tách màu trắng kem */}
        <rect
          x="19"
          y="25.5"
          width="23"
          height="2.8"
          rx="0.6"
          fill="#FCF9F2"
          stroke="#4E311E"
          strokeWidth="2"
        />

        {/* Đĩa lót phẳng bên dưới */}
        <line
          x1="15"
          y1="49"
          x2="46"
          y2="49"
          stroke="#4E311E"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>

      {/* Cụm chữ BrewLite & CÀ PHÊ & TRÀ */}
      <div className="leading-none text-left">
        <div className="flex items-center gap-2">
          <span className={`${titleSize} font-extrabold tracking-tight text-[#4E311E]`}>
            BrewLite
          </span>
          {showBadge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4E311E] text-white">
              ADMIN
            </span>
          )}
        </div>
        <div
          className={`${subSize} font-normal tracking-[0.12em] uppercase text-[#4E311E] mt-1`}
        >
          {tx('CÀ PHÊ & TRÀ', 'COFFEE & TEA')}
        </div>
      </div>
    </div>
  );
}