import Link from 'next/link';
import type { MeResponseDto } from '@brewlite/api-client';
import { getT } from '@/i18n/server';
import { AccountMenu } from './AccountMenu';
import { CartButton } from './CartButton';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

/** The customer header: logo, language, cart, and the account control for the session (frames 14:1731…15:491). */
export async function Header({ me }: Readonly<{ me: MeResponseDto | null }>) {
  const { t } = await getT('common');
  return (
    <header className="border-base-300 bg-base-100 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-15 max-w-288 items-center pr-2 pl-3.5 lg:h-18 lg:px-4">
        <Logo />
        <div className="ml-auto flex items-center gap-0.5 lg:gap-2">
          <LanguageSwitch />
          {/* After the account control from `lg`, as drawn (D09). */}
          <div className="flex lg:order-last">
            <CartButton />
          </div>
          {me ? (
            <AccountMenu
              user={{ fullName: me.fullName, email: me.email, permissions: me.permissions }}
            />
          ) : (
            <Link href="/login" className="btn btn-outline btn-primary rounded-full">
              {t('header.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
