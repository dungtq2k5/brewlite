'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveStaffProfile } from '@/lib/staff/actions';
import type { StaffUser } from '@/lib/staff/contracts';
import { useStaffI18n } from './i18n';
export function StaffProfile({ user }: { user: StaffUser }) {
  const { locale, setLocale, t, dateTime } = useStaffI18n();
  const router = useRouter();
  const [name, setName] = useState(user.fullName);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    setName(user.fullName);
  }, [user.fullName]);
  const initialName = user.fullName;
  const language = locale;
  const handleReset = () => {
    if (locked.current) return;
    setName(user.fullName);
    setSaved(false);
    setError('');
    router.refresh();
  };
  const handleSave = async () => {
    if (locked.current) return;
    const fullName = name.normalize('NFC').trim();
    if (!fullName || fullName.length > 100) {
      setError('Tên phải có từ 1 đến 100 ký tự.');
      return;
    }
    locked.current = true;
    setPending(true);
    setSaved(false);
    setError('');
    try {
      const result = await saveStaffProfile({ fullName, preferredLocale: locale });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName(result.data.fullName);
      setSaved(true);
      router.refresh();
    } catch {
      setError('requestFailed');
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return (
    <div className="w-full max-w-[1000px] text-[#68442f]">
      <h1 className="m-0 text-[29px] font-semibold max-sm:text-2xl">{t('Tài khoản')}</h1>

      <p className="mb-4 mt-1 text-[13px] text-[#8c7e74] max-sm:text-xs max-sm:leading-relaxed">
        {t('Quản lý thông tin cá nhân và ngôn ngữ hiển thị.')}
      </p>

      {error && (
        <p
          id="profile-error"
          role="alert"
          className="mb-3 rounded-lg bg-[#fff0eb] p-3 text-xs text-[#a13d2b]"
        >
          {t(error)}
        </p>
      )}
      {saved && (
        <div
          role="status"
          className="mb-[14px] flex items-start gap-3 rounded-[10px] border border-[#c5d8c5] bg-[#dce8dc] px-4 py-3 text-[#365b43]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>

          <div>
            <p className="m-0 text-xs font-semibold">{t('Đã cập nhật hồ sơ')}</p>
            <p className="mb-0 mt-1 text-[11px] text-[#64816a]">
              {t('Thay đổi của bạn đã được lưu.')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[255px_minmax(0,470px)] items-stretch gap-[15px] max-[768px]:grid-cols-[minmax(190px,0.8fr)_minmax(0,1.5fr)] max-[768px]:gap-3 max-[600px]:grid-cols-1 max-[600px]:gap-[14px]">
        <div className="mt-0 flex min-w-0 flex-col items-center gap-[7px] rounded-[14px] border border-[#ead5b9] bg-[#fffaf4] p-[18px] max-[768px]:p-[14px] max-[600px]:p-[18px]">
          <div className="grid h-[55px] w-[55px] flex-none place-items-center rounded-full bg-[#5e3b27] text-[17px] font-bold text-[#fff9ef]">
            MA
          </div>

          <div className="mt-1 text-center text-sm text-[#632a00]">{name || initialName}</div>

          <small className="rounded-xl bg-[#f0d4b0] px-[9px] py-1 text-[10px] text-[#68442f]">
            {t('Nhân viên')}
          </small>

          <div className="mt-[10px] w-full border-t border-[#eee1d2]">
            <div className="flex min-h-[29px] items-center justify-between gap-2 border-b border-[#eee1d2] py-1.5 text-[9px] max-[768px]:flex-wrap max-[768px]:text-[10px] max-[600px]:min-h-[36px] max-[600px]:flex-nowrap max-[600px]:text-xs">
              <span className="shrink-0 text-[#988a79]">{t('Email')}</span>
              <strong className="min-w-0 break-words text-right font-semibold text-[#704b35]">
                {user.email}
              </strong>
            </div>

            <div className="flex min-h-[29px] items-center justify-between gap-2 border-b border-[#eee1d2] py-1.5 text-[9px] max-[768px]:flex-wrap max-[768px]:text-[10px] max-[600px]:min-h-[36px] max-[600px]:flex-nowrap max-[600px]:text-xs">
              <span className="shrink-0 text-[#988a79]">{t('Ngày tạo tài khoản')}</span>
              <strong className="min-w-0 break-words text-right font-semibold text-[#704b35]">
                {dateTime(user.createdAt)}
              </strong>
            </div>

            <div className="flex min-h-[29px] items-center justify-between gap-2 py-1.5 text-[9px] max-[768px]:flex-wrap max-[768px]:text-[10px] max-[600px]:min-h-[36px] max-[600px]:flex-nowrap max-[600px]:text-xs">
              <span className="shrink-0 text-[#988a79]">{t('Bảo mật')}</span>
              <strong className="min-w-0 break-words text-right font-semibold text-[#704b35]">
                {t(user.hasPassword ? 'Đã thiết lập mật khẩu' : 'Chưa thiết lập mật khẩu')}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-0 min-w-0 rounded-[14px] border border-[#ead5b9] bg-[#fffaf4] p-[18px] max-[768px]:p-[14px] max-[600px]:p-[18px]">
          <h2 className="mb-1 text-lg font-medium text-[#68442f]">{t('Chỉnh hồ sơ')}</h2>

          <small className="mb-[18px] block text-[11px] text-[#988a79]">
            {t('Cập nhật tên hiển thị và ngôn ngữ.')}
          </small>

          <div className="flex flex-col gap-2">
            <label htmlFor="fullName" className="mt-0.5 text-xs font-semibold text-[#68442f]">
              {t('Họ và tên *')}
            </label>

            <input
              disabled={pending}
              maxLength={100}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'profile-error' : undefined}
              id="fullName"
              type="text"
              value={name}
              placeholder={t('Nhập họ và tên')}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              className="box-border w-full min-w-0 rounded-[9px] border border-[#ead5b9] bg-[#fffaf4] p-[11px] text-xs text-[#68442f] outline-none focus:border-[#a87955]"
            />

            <label htmlFor="language" className="mt-0.5 text-xs font-semibold text-[#68442f]">
              {t('Ngôn ngữ hiển thị')}
            </label>

            <select
              disabled={pending}
              id="language"
              value={language}
              onChange={(e) => {
                setLocale(e.target.value === 'vi' ? 'vi' : 'en');
                setSaved(false);
              }}
              className="box-border w-full min-w-0 rounded-[9px] border border-[#ead5b9] bg-[#fffaf4] p-[11px] text-xs text-[#68442f] outline-none focus:border-[#a87955]"
            >
              <option value="vi">{t('Tiếng Việt')}</option>
              <option value="en">{t('English')}</option>
            </select>
          </div>

          <div className="mt-[18px] flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={pending}
              className="cursor-pointer rounded-[9px] border border-[#ead5b9] bg-[#fffaf4] px-4 py-[11px] text-xs font-semibold text-[#68442f] transition-colors hover:bg-[#f5eadc]"
            >
              {t('Tải lại')}
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={pending}
              className="cursor-pointer rounded-[9px] border border-[#68442f] bg-[#68442f] px-4 py-[11px] text-xs font-semibold text-white transition-colors hover:bg-[#4e3021]"
            >
              {t(pending ? 'Đang lưu…' : 'Lưu thay đổi')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
