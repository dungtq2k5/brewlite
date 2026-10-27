'use client';

import { useLocale } from '@/i18n/locale-context';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const { tx } = useLocale();
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs font-medium text-[#8C6A50]">
          {tx(`Tổng ${totalItems} mục`, `Total ${totalItems} items`)}
        </span>
      </div>
    );
  }

  // Tạo mảng số trang hiển thị thông minh khi totalPages > 7
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const items: (number | 'ellipsis')[] = [1];
    if (page > 3) items.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    if (page < totalPages - 2) items.push('ellipsis');
    items.push(totalPages);
    return items;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-8 h-8 flex items-center justify-center text-[#8C6A50] hover:text-[#4E311E] disabled:opacity-30 text-xl font-bold cursor-pointer"
          title={tx('Trang trước', 'Previous page')}
        >
          ‹
        </button>

        {pages.map((p, idx) => {
          if (p === 'ellipsis') {
            return (
              <span key={`ellipsis-${idx}`} className="w-6 text-center text-xs text-[#8C6A50] font-bold select-none">
                ...
              </span>
            );
          }
          const isActive = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#4E311E] text-white ring-2 ring-[#8C6A50] ring-offset-1 ring-offset-[#F5EFE6]'
                  : 'bg-[#9B7B60] text-white hover:bg-[#4E311E]'
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-8 h-8 flex items-center justify-center text-[#8C6A50] hover:text-[#4E311E] disabled:opacity-30 text-xl font-bold cursor-pointer"
          title={tx('Trang sau', 'Next page')}
        >
          ›
        </button>
      </div>
      <span className="text-xs font-medium text-[#8C6A50]">
        {tx(
          `Tổng ${totalItems} mục · Trang ${page}/${totalPages}`,
          `Total ${totalItems} items · Page ${page}/${totalPages}`,
        )}
      </span>
    </div>
  );
}