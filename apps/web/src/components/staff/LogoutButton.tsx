'use client';
import { useRouter } from 'next/navigation';
import { StaffIcon } from './StaffIcon';
import { useRef, useState } from 'react';
import { useStaffI18n } from './i18n';
export default function LogoutButton() {
  const router = useRouter();
  const { t } = useStaffI18n();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const locked = useRef(false);
  const handleLogout = async () => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (!response.ok) throw new Error();
      router.replace('/login');
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="mt-[18px] mb-[5px] ml-[7px] flex items-center gap-[9px] text-[10px] text-[#d34932] disabled:opacity-55 [&_svg]:size-[15px]"
        onClick={handleLogout}
      >
        <StaffIcon name="logout" />
        <span>{t(pending ? 'Đang xử lý...' : 'Đăng xuất')}</span>
      </button>
      {failed && (
        <p role="alert" className="text-xs text-[#a13d2b]">
          {t('requestFailed')}
        </p>
      )}
    </div>
  );
}
