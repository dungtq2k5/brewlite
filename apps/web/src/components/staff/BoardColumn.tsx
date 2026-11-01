import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardStatus } from '@/lib/staff/board';

const DOT = {
  PAID: 'bg-info',
  PREPARING: 'border-primary border-2',
  READY: 'bg-success',
} as const;

/**
 * A column: a sticky header (*Paid 3*) over a body that scrolls on its own. On a phone the tabs
 * already name the column and carry its count, so the header is not repeated.
 */
export function BoardColumn({
  status,
  count,
  hidden,
  children,
}: Readonly<{ status: BoardStatus; count: number; hidden: boolean; children: ReactNode }>) {
  const { t } = useTranslation('staff');
  return (
    <section
      aria-labelledby={`col-${status}`}
      className={`bg-base-200 rounded-box min-h-0 flex-col max-sm:w-full sm:flex sm:w-[280px] sm:shrink-0 sm:snap-start lg:w-auto lg:shrink ${
        hidden ? 'max-sm:hidden' : 'flex'
      }`}
    >
      <h2
        id={`col-${status}`}
        className="bg-base-200 rounded-t-box sticky top-0 z-10 flex items-center max-sm:hidden gap-2 px-4 py-3 text-lg font-bold"
      >
        <span aria-hidden className={`size-2.5 rounded-full ${DOT[status]}`} />
        {t(`column.${status}`)}
        <span className="bg-neutral text-neutral-content rounded-full px-2 text-sm tabular-nums">
          {count}
        </span>
      </h2>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">{children}</div>
    </section>
  );
}
