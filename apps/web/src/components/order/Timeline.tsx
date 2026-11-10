import type { OrderResponseDto } from '@brewlite/api-client';
import { useTranslation } from 'react-i18next';
import { clockTime } from '@/lib/order/deadline';

/** `history` as an ordered list with a rail: what, then when (Vietnam time) · by whom. The last row is "now". */
export function Timeline({ history }: Readonly<{ history: OrderResponseDto['history'] }>) {
  const { t } = useTranslation('orders');
  if (history.length === 0) return null;
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="mb-3 text-lg font-semibold">
        {t('order.timeline.heading')}
      </h2>
      <ol>
        {history.map((item, index) => {
          const current = index === history.length - 1;
          const actor = t(`order.timeline.actor.${item.actorType}`, { defaultValue: '' });
          return (
            <li
              key={`${item.toStatus}-${item.createdAt}`}
              aria-current={current ? 'step' : undefined}
              className="flex gap-3"
            >
              <span aria-hidden className="flex w-4 flex-col items-center">
                <span
                  className={`mt-1.5 shrink-0 rounded-full ${current ? 'bg-primary size-4' : 'bg-base-300 size-3'}`}
                />
                {!current && <span className="bg-base-300 my-1 w-0.5 flex-1" />}
              </span>
              <div className={current ? 'pb-0' : 'pb-4'}>
                <p className="font-semibold">{t(`order.timeline.status.${item.toStatus}`)}</p>
                <p className="text-base-content/70 text-sm tabular-nums">
                  {clockTime(item.createdAt)}
                  {actor && ` · ${actor}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
