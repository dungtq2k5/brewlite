'use client';

import { ArrowDown, Coffee, Lock, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dismissHero } from '@/actions/preferences';
import type { HeroVariant } from '@/lib/menu-hero';
import { useMenuQuery } from './MenuQuery';

/** Step 3's icon: a tiny pickup ticket (D01's order-number style), decorative. */
function TicketChip() {
  return (
    <span
      aria-hidden
      className="bg-base-100 text-primary relative flex h-7 w-20 items-center rounded-lg text-xs"
    >
      <span className="bg-secondary absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full" />
      <span className="w-5 text-center text-[10px]">#</span>
      <span className="border-primary/40 h-3/5 border-l border-dashed" />
      <span className="flex-1 text-center font-extrabold tabular-nums">1042</span>
    </span>
  );
}

function IconChip({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span aria-hidden className="bg-base-100 grid h-7 w-10 place-items-center rounded-lg">
      {children}
    </span>
  );
}

const STEPS = [
  {
    key: 'choose',
    icon: (
      <IconChip>
        <Coffee size={16} />
      </IconChip>
    ),
  },
  {
    key: 'pay',
    icon: (
      <IconChip>
        <Lock size={16} />
      </IconChip>
    ),
  },
  { key: 'collect', icon: <TicketChip /> },
] as const;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The welcome hero above the menu (D07, `122:1072`): the full card for guests, a one-line strip
 * once signed in. The server picks the variant (or none, once dismissed); `bl-menu-hero` hides it
 * in the installed app; it steps aside while a search is typed. Nothing animates.
 */
export function MenuHero({ variant }: Readonly<{ variant: HeroVariant }>) {
  const { t } = useTranslation('menu');
  const { query, focusField } = useMenuQuery();
  const [hidden, setHidden] = useState(false);
  if (hidden || query.trim() !== '') return null;

  const hide = () => {
    setHidden(true);
    // A blocked cookie only means the hero comes back next visit.
    void dismissHero().catch(() => undefined);
    // After the hero unmounts, so the field is where it will stay.
    requestAnimationFrame(focusField);
  };

  const close = (
    <button
      type="button"
      aria-label={t('hero.hide')}
      onClick={hide}
      className="grid size-11 shrink-0 place-items-center rounded-full"
    >
      <X aria-hidden size={20} />
    </button>
  );

  if (variant === 'compact') {
    return (
      <div className="bl-menu-hero bg-secondary rounded-box mb-4 flex items-center gap-3 py-1 pr-1 pl-4">
        <TicketChip />
        <p className="flex-1 text-sm font-medium">{t('hero.compact')}</p>
        {close}
      </div>
    );
  }

  const orderNow = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const heading = document.querySelector<HTMLElement>('#menu h2');
    if (!heading) return;
    event.preventDefault();
    heading.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  // One grid: text, steps, action down a phone; on a desktop the steps take the right column.
  return (
    <div className="bl-menu-hero bg-secondary rounded-box relative mb-4 grid p-4 lg:grid-cols-[1fr_20rem] lg:gap-x-8 lg:p-6">
      <div className="absolute top-1 right-1">{close}</div>
      <div>
        <p className="pr-10 text-2xl leading-tight font-bold lg:text-3xl">{t('hero.headline')}</p>
        <p className="mt-2 text-sm lg:text-base">{t('hero.line')}</p>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2 text-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center">
        {STEPS.map((step) => (
          <li key={step.key} className="flex flex-col items-center gap-1">
            {step.icon}
            <span className="text-sm font-semibold">{t(`hero.steps.${step.key}.name`)}</span>
            <span className="text-base-content/80 text-xs">{t(`hero.steps.${step.key}.line`)}</span>
          </li>
        ))}
      </ol>
      <a
        href="#menu"
        onClick={orderNow}
        className="btn btn-primary mt-4 min-h-11 w-full lg:col-start-1 lg:w-auto lg:justify-self-start"
      >
        {t('hero.orderNow')}
        <ArrowDown aria-hidden size={18} />
      </a>
    </div>
  );
}
