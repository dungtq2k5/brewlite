'use client';

import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ANNOUNCE_AT_MINUTES, deadlineView, msToNextMinute } from '@/lib/order/deadline';

/**
 * *Pay by 14:35 · 12 min left*, recomputed on the minute. Not a live region (it would chatter);
 * the page's polite region hears one announcement, at two minutes, through `onAnnounce`.
 */
export function Deadline({
  expiresAt,
  onPassed,
  onAnnounce,
}: Readonly<{
  expiresAt: string;
  onPassed: () => void;
  onAnnounce: (text: string) => void;
}>) {
  const { t } = useTranslation('orders');
  const [now, setNow] = useState(() => Date.now());

  // A new deadline (payment starting moves it) is read at once, in a timer — not in the effect body.
  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(msToNextMinute(expiresAt, now), 250),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, now]);

  const view = deadlineView(expiresAt, now);
  const passed = view.state === 'passed';
  const minutes = view.state === 'passed' ? 0 : view.minutes;

  useEffect(() => {
    if (passed) onPassed();
  }, [passed, onPassed]);
  useEffect(() => {
    if (minutes === ANNOUNCE_AT_MINUTES)
      onAnnounce(t('order.deadline.announce', { count: minutes }));
  }, [minutes, onAnnounce, t]);

  const warning = view.state === 'warning';
  return (
    <p
      className={`rounded-field flex items-center gap-2 px-3 py-2 text-sm font-medium ${
        passed || warning ? 'bg-error/10 text-error' : 'bg-base-200'
      }`}
    >
      <Clock aria-hidden size={16} />
      {view.state === 'passed'
        ? t('order.deadline.passed')
        : t(warning ? 'order.deadline.warning' : 'order.deadline.payBy', {
            time: view.time,
            count: view.minutes,
          })}
    </p>
  );
}
