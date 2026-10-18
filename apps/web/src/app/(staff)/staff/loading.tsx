'use client';
import { useStaffI18n } from '@/components/staff/i18n';
export default function Loading() {
  const { t } = useStaffI18n();
  return (
    <div className="min-h-screen rounded-md border border-[#e8dcc8] bg-[#f7efdf] p-[14px]">
      {' '}
      <h1 className="m-0 text-[12px] font-medium leading-[18px] tracking-[-0.2px] text-[#805a40]">
        {' '}
        {t('Đơn đang xử lý')}{' '}
      </h1>
      <div className="mt-[9px] grid grid-cols-1 gap-[7px] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[106px] rounded-[7px] border border-[#eadcc5] bg-[#fffaf3] p-[7px]"
          >
            <div className="animate-pulse space-y-[8px]">
              <div className="h-[7px] w-full rounded-[3px] bg-[#f3ece2]" />
              <div className="h-[20px] w-[70%] rounded-[3px] bg-[#f3ece2]" />
              <div className="h-[7px] w-[45%] rounded-[3px] bg-[#f3ece2]" />
              <div className="mt-[17px] h-[15px] w-full rounded-[3px] bg-[#f3ece2]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
