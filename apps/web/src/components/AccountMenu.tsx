'use client';

import { ChevronDown, ChevronRight, LayoutGrid, Receipt, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './LanguageSwitch';
import { SignOutButton } from './SignOutButton';

export interface AccountMenuUser {
  fullName: string;
  email: string;
  permissions: readonly string[];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** A bottom sheet under 640 px, a dropdown above; role links come from `Me.permissions`. */
export function AccountMenu({
  user,
  withLanguage = false,
}: Readonly<{
  user: AccountMenuUser;
  /** The staff shell hides its header language switch on a phone; the sheet carries it instead. */
  withLanguage?: boolean;
}>) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const can = (p: string) => user.permissions.includes(p);
  const board = can('order.board.read') || can('stock.update');
  const admin = can('menu.manage');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const item = 'flex min-h-11 items-center gap-3 px-4 hover:bg-base-200';
  const close = () => setOpen(false);
  const shortName = user.fullName.split(/\s+/).slice(-2).join(' ');

  return (
    <div className="relative">
      {/* The name contains what is seen (WCAG 2.5.3): "Lan Anh account menu". The initials repeat
          the name, so they are hidden from it. The name is visible from `sm`; below, the same name
          is screen-reader text in a span of its own (no `data-variable`: a mask over a 1-px
          `sr-only` box would draw a dot in every baseline). */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 sm:rounded-full sm:pr-2"
      >
        <span
          aria-hidden
          data-variable
          className="bg-secondary text-secondary-content grid h-9 w-9 place-items-center rounded-full text-sm font-bold"
        >
          {initials(user.fullName)}
        </span>
        <span data-variable className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {shortName}
          <ChevronDown aria-hidden size={16} />
        </span>
        <span className="sr-only sm:hidden">{shortName}</span>
        <span className="sr-only"> {t('header.account')}</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
            aria-hidden
            onClick={close}
          />
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={t('account.title')}
            className="bg-base-100 fixed inset-x-0 bottom-0 z-50 rounded-t-3xl pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-60 sm:rounded-box sm:py-2"
          >
            <div
              className="bg-base-content/80 mx-auto mb-3 h-1 w-10 rounded-full sm:hidden"
              aria-hidden
            />
            <div className="mb-2 flex items-center gap-3 px-6 sm:hidden">
              <span
                data-variable
                className="bg-secondary text-secondary-content grid h-12 w-12 place-items-center rounded-full font-bold"
              >
                {initials(user.fullName)}
              </span>
              <div data-variable className="min-w-0">
                <p className="truncate font-semibold">{user.fullName}</p>
                <p className="truncate text-sm">{user.email}</p>
              </div>
            </div>
            {withLanguage && (
              <div className="flex items-center justify-between px-6 py-2 sm:hidden">
                <span className="font-medium">{t('language.label')}</span>
                <LanguageSwitch />
              </div>
            )}
            <nav className="flex flex-col">
              <Link href="/orders" className={item} onClick={close}>
                <Receipt aria-hidden size={20} />
                <span className="flex-1">{t('account.orders')}</span>
                <ChevronRight aria-hidden size={18} className="sm:hidden" />
              </Link>
              <Link href="/account" className={item} onClick={close}>
                <User aria-hidden size={20} />
                <span className="flex-1">{t('account.settings')}</span>
                <ChevronRight aria-hidden size={18} className="sm:hidden" />
              </Link>
              {board && (
                <Link href="/staff" className={item} onClick={close}>
                  <LayoutGrid aria-hidden size={20} />
                  <span className="flex-1">{t('account.staffBoard')}</span>
                  <ChevronRight aria-hidden size={18} className="sm:hidden" />
                </Link>
              )}
              {admin && (
                <Link href="/admin" className={item} onClick={close}>
                  <Shield aria-hidden size={20} />
                  <span className="flex-1">{t('account.admin')}</span>
                  <ChevronRight aria-hidden size={18} className="sm:hidden" />
                </Link>
              )}
              <div className="border-base-300 mx-4 my-1 border-t" role="separator" />
              <SignOutButton onCancel={close} />
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
