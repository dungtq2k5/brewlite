'use client';

import { useLocale } from '@/i18n/locale-context';

interface EmptyStateProps {
  titleVi?: string;
  titleEn?: string;
  descVi?: string;
  descEn?: string;
}

export function EmptyState({
  titleVi = 'Không tìm thấy dữ liệu phù hợp',
  titleEn = 'No matching records found',
  descVi = 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phía trên nhé.',
  descEn = 'Try adjusting your search keyword or filters above.',
}: EmptyStateProps) {
  const { tx } = useLocale();

  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
      <svg
        viewBox="0 0 96 72"
        className="w-24 h-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M20 34C12 34 10 42 18 46"
          stroke="#4E311E"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M72 36C79 31 84 31 87 28"
          stroke="#4E311E"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <ellipse
          cx="46"
          cy="44"
          rx="26"
          ry="18"
          fill="#B83B2A"
          stroke="#4E311E"
          strokeWidth="3"
        />
        <path d="M32 28H60" stroke="#4E311E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="46" cy="24" r="4" fill="#B83B2A" stroke="#4E311E" strokeWidth="2.8" />
      </svg>
      <h3 className="text-base font-extrabold text-[#4E311E]">{tx(titleVi, titleEn)}</h3>
      <p className="text-xs text-[#8C6A50] max-w-xs">{tx(descVi, descEn)}</p>
    </div>
  );
}