'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { StaffUser } from '@/lib/staff/contracts';
import { StaffIcon } from './StaffIcon';
import LogoutButton from './LogoutButton';
import { useStaffI18n } from './i18n';
const navigation = [
  { href: '/staff', label: 'Đơn đang xử lý', icon: 'receipt' },
  { href: '/staff/stocks', label: 'Tồn kho', icon: 'box' },
  { href: '/staff/account', label: 'Tài khoản', icon: 'user' },
] as const;
function StaffNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { t } = useStaffI18n();
  return (
    <nav
      aria-label={t('Tài khoản nhân viên')}
      className={
        mobile
          ? 'fixed inset-x-0 bottom-0 z-10 hidden h-16 border-t border-[#ead7ba] bg-[#fffcf7] max-[650px]:flex'
          : 'grid gap-[5px]'
      }
    >
      {navigation.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          className={`flex min-h-[35px] items-center whitespace-nowrap font-semibold text-[#82705f] no-underline hover:bg-[#f2d6b1] hover:text-[#68452e] aria-[current=page]:text-[#68452e] focus-visible:outline-2 focus-visible:outline-[#825c3d] [&_svg]:size-[14px] [&_svg]:shrink-0 [&_svg]:stroke-[1.65] ${mobile ? 'flex-1 flex-col justify-center gap-1 rounded-none p-0 text-[9px] aria-[current=page]:bg-transparent' : 'gap-[10px] rounded-lg px-[10px] text-[13px] aria-[current=page]:bg-[#f2d6b1]'}`}
        >
          <StaffIcon name={item.icon} />
          <span>{t(item.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
export function StaffShell({ user, children }: { user: StaffUser; children: ReactNode }) {
  const { locale, setLocale, t } = useStaffI18n();
  return (
    <div className="box-border h-dvh min-h-0 overflow-hidden bg-[#eeebe6] bg-[radial-gradient(#ded9d0_0.7px,transparent_0.7px)] bg-size-[28px_28px] p-0 font-[Arial,Helvetica,sans-serif] text-[#593b2a]">
      <div className="flex h-full max-h-full min-h-0 overflow-hidden border border-[#d5c9ba] bg-[#f7efde] shadow-[0_15px_28px_#3e2b1b1a,0_1px_2px_#3e2b1b12] max-[800px]:border-0 max-[650px]:block">
        <aside className="box-border flex h-full max-h-full min-h-0 min-w-0 flex-[0_0_196px] flex-col overflow-y-auto border-r border-[#e9d9c2] bg-[#fffcf7] px-[13px] pt-[21px] pb-[19px] max-[800px]:basis-[150px] max-[800px]:px-[10px] max-[650px]:hidden">
          <Link
            href="/staff"
            className="mb-[31px] flex items-center gap-[7px] whitespace-nowrap text-[#5d3b27] no-underline"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-[#4E3427] text-white shadow-xs">
              <svg aria-hidden="true" className="size-5 fill-current" viewBox="0 0 24 24">
                <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
              </svg>
            </div>
            <strong className="text-base font-extrabold tracking-[-0.55px]">BrewLite</strong>
          </Link>
          <StaffNavigation />
          <div className="min-h-[30px] flex-1" />
          <div className="border-t border-[#ead7ba] px-[3px] pt-[14px]">
            <div className="flex items-center gap-[7px]">
              <span className="grid size-[31px] shrink-0 place-items-center rounded-full bg-[#5e3b27] text-[9px] font-bold text-[#fff9ef]">
                MA
              </span>
              <span className="flex min-w-0 flex-col items-start gap-[3px]">
                <strong className="max-w-full break-words text-xs font-bold">
                  {user.fullName}
                </strong>
                <small className="rounded-[10px] bg-[#f0d4b0] px-[7px] py-[3px] text-[10px] text-[#393939]">
                  {t('Nhân viên')}
                </small>
              </span>
            </div>
            <LogoutButton />
          </div>
        </aside>
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-[650px]:pb-[68px]">
          <header className="flex h-[52px] shrink-0 items-center justify-end border-b border-[#e9d9c2] bg-[#fffcf7] px-[22px] max-[650px]:justify-between max-[650px]:px-4">
            <Link
              href="/staff"
              className="hidden items-center gap-[7px] text-[#5d3b27] no-underline max-[650px]:flex"
            >
              <span className="grid size-[29px] shrink-0 place-items-center rounded-lg bg-[#5d3b27] text-[#fffaf2] [&_svg]:size-4">
                <StaffIcon name="cup" />
              </span>
              <strong className="text-base font-extrabold tracking-[-0.55px]">BrewLite</strong>
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-[5px] whitespace-nowrap text-[8px] text-[#596a56] max-[390px]:hidden">
                {t('Dữ liệu từ máy chủ')}
              </span>
              <div
                role="group"
                aria-label={t('Ngôn ngữ hiển thị')}
                className="flex h-[29px] items-center gap-[9px] rounded-lg border border-[#eed8b9] bg-[#fbf6ed] p-[3px] text-[9px] text-[#8a7868]"
              >
                {(['vi', 'en'] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={locale === value}
                    onClick={() => setLocale(value)}
                    className="grid h-[23px] min-w-[25px] place-items-center rounded-[5px] focus-visible:outline-2 focus-visible:outline-[#825c3d] aria-pressed:bg-[#5d3b27] aria-pressed:font-bold aria-pressed:text-[#fff9ed]"
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#5e3b27] text-[9px] font-bold text-[#fff9ef]">
                MA
              </span>
            </div>
          </header>
          <main className="box-border min-h-0 min-w-0 flex-[1_1_0%] overflow-y-auto pt-[21px] pr-[22px] pb-7 pl-[23px] max-[800px]:px-4 max-[390px]:px-3">
            {children}
          </main>
        </div>
        <StaffNavigation mobile />
      </div>
    </div>
  );
}
