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
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <LanguageSwitch />
          <CartButton />
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
