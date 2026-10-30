import { useTranslation } from 'react-i18next';

const SIZE = {
  large: { box: 'h-[88px] w-80', hash: 'text-3xl', no: 'text-6xl' },
  medium: { box: 'h-[76px] w-64', hash: 'text-2xl', no: 'text-5xl' },
  small: { box: 'h-[52px] w-[136px]', hash: 'text-lg', no: 'text-3xl' },
} as const;

/**
 * The pickup ticket — BrewLite's signature: a flat golden stub, `#` and the number either side of
 * a perforation, a notch cut into each end. Its accessible name is the whole phrase ("Order 1042");
 * the drawing is decoration.
 */
export function OrderTicket({
  orderNo,
  size,
  tone = 'plain',
}: Readonly<{ orderNo: string; size: keyof typeof SIZE; tone?: 'plain' | 'ready' }>) {
  const { t } = useTranslation('orders');
  const s = SIZE[size];
  return (
    <div
      role="img"
      aria-label={t('order.ticket', { no: orderNo })}
      className={`bg-secondary text-primary relative mx-auto flex items-center rounded-2xl ${s.box} ${
        tone === 'ready' ? 'ring-success ring-2' : ''
      }`}
    >
      <span
        aria-hidden
        className="bg-base-100 absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full"
      />
      <span
        aria-hidden
        className="bg-base-100 absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full"
      />
      <span aria-hidden className={`w-1/4 text-center font-medium ${s.hash}`}>
        #
      </span>
      <span aria-hidden className="border-primary/40 h-3/5 border-l border-dashed" />
      <span aria-hidden className={`flex-1 text-center font-extrabold tabular-nums ${s.no}`}>
        {orderNo}
      </span>
    </div>
  );
}
