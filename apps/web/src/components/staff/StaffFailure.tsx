'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { StaffError } from '@/lib/staff/contracts';
import { useStaffI18n } from './i18n';
export function StaffFailure({ error }: { error: StaffError }) {
  const { t } = useStaffI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="rounded-lg border border-[#e8c7bd] bg-[#fff0eb] p-4 text-xs text-[#a13d2b]">
      <p role="alert">{t(error)}</p>
      {error === 'unauthenticated' ? (
        <Link href="/login?next=%2Fstaff">{t('Đăng nhập')}</Link>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
          className="mt-3 rounded-lg border border-[#ead2b3] bg-[#fffcf7] px-4 py-2 disabled:opacity-55"
        >
          {t(pending ? 'Đang tải…' : 'Làm mới')}
        </button>
      )}
    </div>
  );
}
