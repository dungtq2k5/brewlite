'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MenuSection } from '@/lib/menu';
import { useMenuQuery } from './MenuQuery';
import { useFilteredSections } from './MenuSections';
import { MenuSearch } from './MenuSearch';

export interface CategoryNavItem {
  id: string;
  label: string;
}

const HEADER_VAR = '--bl-header-h';
const NAV_VAR = '--bl-nav-h';

/**
 * Chips under the header on a phone, a sticky list beside the grid from 1024 px. Tapping one
 * scrolls to its section; the section under the bar is the current chip, and on a phone that
 * chip is kept in view inside the bar. Section headings carry `scroll-mt` from the two CSS
 * variables this sets (header and bar heights), so the heading lands below both.
 */
export function CategoryNav({
  items: allItems,
  sections,
  title,
}: Readonly<{ items: CategoryNavItem[]; sections: MenuSection[]; title: string }>) {
  const { t } = useTranslation('menu');
  const { query, focusField } = useMenuQuery();
  // While searching, the chips narrow to the categories with results (none → no chips at all).
  const shown = useFilteredSections(sections);
  const searching = query.trim() !== '';
  const count = shown.reduce((sum, s) => sum + s.products.length, 0);
  const items = useMemo(() => {
    if (!searching) return allItems;
    const ids = new Set(shown.map((s) => s.category.id));
    return allItems.filter((item) => ids.has(item.id));
  }, [allItems, shown, searching]);
  const [current, setCurrent] = useState(items[0]?.id);
  const bar = useRef<HTMLElement>(null);
  const chips = useRef(new Map<string, HTMLAnchorElement>());
  // After a tap, the smooth scroll passes other sections; they must not steal "current".
  const settlingUntil = useRef(0);

  // Publish the header's and the bar's heights for the sticky offsets and `scroll-mt`.
  useEffect(() => {
    const header = document.querySelector('header');
    const root = document.documentElement;
    const measure = () => {
      root.style.setProperty(HEADER_VAR, `${header?.getBoundingClientRect().height ?? 0}px`);
      root.style.setProperty(NAV_VAR, `${bar.current?.getBoundingClientRect().height ?? 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (bar.current) observer.observe(bar.current);
    return () => {
      observer.disconnect();
      root.style.removeProperty(HEADER_VAR);
      root.style.removeProperty(NAV_VAR);
    };
  }, []);

  // Scroll-spy: the current section is the last one whose top has reached the line a chip's own
  // scroll lands on — the headings' `scroll-margin-top`, read from the page so the two never
  // drift apart. Read from the layout on every scroll (and once now), so a restored scroll
  // position — back from a product — finds its chip too.
  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(`cat-${item.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    let frame = 0;
    const spy = () => {
      frame = 0;
      if (Date.now() < settlingUntil.current) return;
      const heading = sections[0]!.querySelector('h2') ?? sections[0]!;
      const line = Number.parseFloat(getComputedStyle(heading).scrollMarginTop) + 1;
      let found = sections[0]!;
      for (const section of sections) {
        if (section.getBoundingClientRect().top > line) break;
        found = section;
      }
      setCurrent(found.id.replace(/^cat-/, ''));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(spy);
    };
    spy();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  // Keep the current chip inside the bar (it scrolls sideways on a phone) — moved only when it is
  // out of view, so a chip already seen leaves the bar where it is (D09).
  useEffect(() => {
    const chip = current ? chips.current.get(current) : undefined;
    const scroller = bar.current?.querySelector('ul');
    if (!chip || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const left = chip.offsetLeft - scroller.offsetLeft;
    const inView =
      left >= scroller.scrollLeft &&
      left + chip.offsetWidth <= scroller.scrollLeft + scroller.clientWidth;
    if (inView) return;
    scroller.scrollTo({
      left: chip.offsetLeft - (scroller.clientWidth - chip.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [current]);

  const go = (id: string) => (event: React.MouseEvent) => {
    // The heading, not the section: `scroll-mt` on it keeps it clear of the header and the bar.
    const target = document.getElementById(`cat-heading-${id}`);
    if (!target) return;
    event.preventDefault();
    settlingUntil.current = Date.now() + 900;
    setCurrent(id);
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  // `contents` on a phone: the bar must stick within the whole page, not within its own wrapper.
  return (
    <div className="contents lg:block lg:sticky lg:top-[calc(var(--bl-header-h,3.5rem)+2.5rem)] lg:self-start">
      <h1 className="sr-only text-3xl font-bold lg:not-sr-only lg:mb-4">{title}</h1>
      {/* On a desktop the field heads the sticky list; on a phone it sits above the first section. */}
      <MenuSearch count={count} className="hidden lg:mb-4 lg:block" />
      <nav
        ref={bar}
        aria-label={t('nav.label')}
        className="bg-base-100 border-base-300 sticky top-(--bl-header-h,3.5rem) z-20 -mx-4 -mt-1 border-b px-4 lg:static lg:mx-0 lg:mt-0 lg:border-0 lg:px-0"
      >
        <ul
          className={`flex gap-2 overflow-x-auto py-1.5 scrollbar-none lg:flex-col lg:gap-1 lg:overflow-visible lg:py-0 ${
            items.length === 0 ? 'hidden' : ''
          }`}
        >
          <li className="shrink-0 lg:hidden">
            <button
              type="button"
              aria-label={t('search.open')}
              onClick={focusField}
              className="border-base-300 grid size-11 place-items-center rounded-full border"
            >
              <Search aria-hidden size={18} />
            </button>
          </li>
          {items.map((item) => {
            const active = item.id === current;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  ref={(el) => {
                    if (el) chips.current.set(item.id, el);
                    else chips.current.delete(item.id);
                  }}
                  href={`#cat-heading-${item.id}`}
                  onClick={go(item.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold lg:rounded-field lg:border-0 lg:px-3.5 lg:text-base ${
                    active
                      ? 'bg-primary text-primary-content border-primary'
                      : 'border-base-300 hover:bg-base-200'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
