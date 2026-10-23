'use client';

import { ChevronDown, ChevronRight, LayoutGrid, Receipt, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
export function AccountMenu({ user }: Readonly<{ user: AccountMenuUser }>) {
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

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('header.account')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 sm:rounded-full sm:pr-2"
      >
        <span className="bg-secondary text-secondary-content grid h-9 w-9 place-items-center rounded-full text-sm font-bold">
          {initials(user.fullName)}
        </span>
        <span className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {user.fullName.split(/\s+/).slice(-2).join(' ')}
          <ChevronDown aria-hidden size={16} />
        </span>
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
              <span className="bg-secondary text-secondary-content grid h-12 w-12 place-items-center rounded-full font-bold">
                {initials(user.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.fullName}</p>
                <p className="truncate text-sm">{user.email}</p>
              </div>
            </div>
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
