'use client';

import { Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderResponseDto } from '@brewlite/api-client';
import { advanceOrder } from '@/actions/staff';
import { useLiveStream, type OrderStatusFrame } from '@/lib/live/useLiveStream';
import {
  BOARD_COLUMNS,
  clearOverlays,
  isRelevantFrame,
  newOrderIds,
  pendingMove,
  placeOrders,
  type BoardStatus,
  type MoveTo,
  type Overlay,
} from '@/lib/staff/board';
import { playChime, prepareAudio } from '@/lib/staff/chime';
import { clearLive, setLive } from '@/lib/staff/live-status';
import { useNow } from '@/lib/staff/useNow';
import { waitMinutes } from '@/lib/staff/wait';
import { useErrorMessage } from '../useErrorMessage';
import { useToast } from '../Toast';
import { BoardColumn } from './BoardColumn';
import { BoardOrderCard } from './BoardOrderCard';
import { StaffCancelDialog } from './StaffCancelDialog';
import { UndoToast } from './UndoToast';

const UNDO_MS = 5000;
const NEW_FOR_MS = 60_000;
const MOVED_FOR_MS = 5000;

/**
 * The counter's board. It renders **server data plus local overlays** so a refresh never undoes
 * what the barista is doing: a card moves at once, *Ready* and *Collected* wait out a 5 s undo
 * window before they are sent, and a refusal (another tablet moved it) is a quiet line, not a
 * dialog. The stream only says "something changed"; the page re-reads itself for the frames that
 * concern the board.
 */
export function Board({ orders }: Readonly<{ orders: OrderResponseDto[] }>) {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const message = useErrorMessage();
  const toast = useToast();

  const [overlays, setOverlays] = useState<Map<string, Overlay>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  // id → until: cards marked *New*; and the one announcement for the newest.
  const [fresh, setFresh] = useState<Map<string, number>>(new Map());
  const [announcement, setAnnouncement] = useState('');
  const [chimes, setChimes] = useState(0);
  const [previous, setPrevious] = useState<OrderResponseDto[] | null>(null);
  const [tab, setTab] = useState<BoardStatus>('PAID');
  const [cancelling, setCancelling] = useState<{ id: string; orderNo: string } | null>(null);

  const busy = overlays.size > 0 || fresh.size > 0;
  const now = useNow(busy ? 1000 : 15_000);

  // New data (after a refresh): find new paid orders, and let overlays the server now agrees with go.
  if (previous !== orders) {
    setPrevious(orders);
    const ids = newOrderIds(previous, orders);
    if (ids.length > 0) {
      setFresh(
        (m) => new Map([...m, ...ids.map((id): [string, number] => [id, now + NEW_FOR_MS])]),
      );
      const numbers = orders.filter((o) => ids.includes(o.id)).map((o) => o.orderNo);
      setAnnouncement(numbers.map((no) => t('new.announce', { no })).join('. '));
      setChimes((n) => n + ids.length);
    }
    setOverlays((m) => clearOverlays(m, orders, now));
  }

  // The chime is a side effect, not state: one tone pair per new order.
  const chimed = useRef(0);
  useEffect(() => {
    for (; chimed.current < chimes; chimed.current += 1) playChime();
  }, [chimes]);

  // ─── Moves ────────────────────────────────────────────────────────────────────────────────
  const send = useCallback(
    async (id: string, to: MoveTo) => {
      setOverlays((m) => new Map(m).set(id, { kind: 'inFlight', to }));
      setErrors((m) => withoutKey(m, id));
      const result = await advanceOrder(id, to);
      if (result.ok) {
        router.refresh();
        // Safety: an overlay the server never "agrees" with (it moved on again) must not stay.
        setTimeout(
          () => setOverlays((m) => (m.get(id)?.kind === 'inFlight' ? withoutKey(m, id) : m)),
          4000,
        );
        return;
      }
      if (result.code === 'INVALID_STATE') {
        setOverlays((m) => new Map(m).set(id, { kind: 'moved', until: Date.now() + MOVED_FOR_MS }));
        router.refresh();
        return;
      }
      setOverlays((m) => withoutKey(m, id));
      const order = orders.find((o) => o.id === id);
      setErrors((m) =>
        new Map(m).set(
          id,
          `${t('moveFailed', { no: order?.orderNo ?? '' })} ${message(result.code, result.details)}`,
        ),
      );
    },
    [orders, router, message, t],
  );

  // The move waiting out its undo window, and its timer. One at a time.
  const pending = useRef<{ id: string; to: MoveTo; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );
  // `send` changes with every refresh; the pending move's timer and the leave handlers must not.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const sendPending = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    void sendRef.current(p.id, p.to);
  }, []);

  const forward = (id: string, to: MoveTo) => {
    sendPending(); // any other action sends the pending move first
    if (to === 'PREPARING') {
      void send(id, to); // *Start* leaves at once
      return;
    }
    const sendAt = Date.now() + UNDO_MS;
    setOverlays((m) => new Map(m).set(id, { kind: 'pending', to, sendAt }));
    pending.current = { id, to, timer: setTimeout(sendPending, UNDO_MS) };
  };

  const undo = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setOverlays((m) => withoutKey(m, p.id)); // nothing was sent
  };

  // A pending move must not be lost silently: send it on leaving the page (best effort).
  useEffect(() => {
    const leave = () => sendPending();
    const hide = () => document.visibilityState === 'hidden' && sendPending();
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hide);
      sendPending();
    };
  }, [sendPending]);

  // ─── The stream ───────────────────────────────────────────────────────────────────────────
  const onBoard = new Set(orders.map((o) => o.id));
  const { live, reconnecting } = useLiveStream('/api/events/staff', {
    enabled: true,
    onEvent: (frame: OrderStatusFrame) => {
      if (isRelevantFrame(frame, onBoard)) router.refresh();
    },
  });
  useEffect(() => {
    setLive({ active: true, live, reconnecting });
  }, [live, reconnecting]);
  useEffect(() => clearLive, []);

  // ─── Render ───────────────────────────────────────────────────────────────────────────────
  const columns = placeOrders(orders, overlays);
  const pendingNow = pendingMove(overlays);
  const pendingOrder = pendingNow && orders.find((o) => o.id === pendingNow.id);
  const empty = orders.length === 0 && overlays.size === 0;

  return (
    // Any tap on the board lets the browser play the chime (it needs a tap after a reload).
    <div className="flex h-full min-h-0 flex-col gap-3" onPointerDown={prepareAudio}>
      <div role="status" className="sr-only">
        {announcement}
      </div>

      <div
        role="tablist"
        aria-label={t('tabs.label')}
        className="bg-base-100 rounded-box flex gap-1 p-1 sm:hidden"
      >
        {BOARD_COLUMNS.map((status) => (
          <button
            key={status}
            role="tab"
            type="button"
            aria-selected={tab === status}
            onClick={() => {
              sendPending();
              setTab(status);
            }}
            className={`min-h-11 flex-1 rounded-field px-2 text-sm font-semibold ${
              tab === status ? 'bg-primary text-primary-content' : ''
            }`}
          >
            {t(`column.${status}`)}
            <span
              className={`ml-2 rounded-full px-2 text-sm tabular-nums ${
                tab === status ? 'bg-base-100 text-primary' : 'bg-neutral text-neutral-content'
              }`}
            >
              {columns[status].length}
            </span>
          </button>
        ))}
      </div>

      {empty ? (
        <div className="grid flex-1 place-items-center text-center">
          <div className="flex flex-col items-center gap-3">
            <Inbox aria-hidden size={40} />
            <p className="text-lg">{t('empty.board')}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 sm:snap-x sm:overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-x-visible">
          {BOARD_COLUMNS.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              count={columns[status].length}
              hidden={tab !== status}
            >
              {columns[status].length === 0 ? (
                <p className="text-base-content/70 py-6 text-center">{t('empty.column')}</p>
              ) : (
                columns[status].map((order) => {
                  const overlay = overlays.get(order.id);
                  return (
                    <BoardOrderCard
                      key={order.id}
                      order={order}
                      column={status}
                      inFlightTo={overlay?.kind === 'inFlight' ? overlay.to : undefined}
                      isNew={(fresh.get(order.id) ?? 0) > now}
                      minutes={waitMinutes(order.paidAt ?? order.createdAt, now)}
                      movedElsewhere={overlay?.kind === 'moved' && overlay.until > now}
                      error={errors.get(order.id)}
                      canCancel={status === 'PAID' && order.status === 'PAID' && !overlay}
                      onForward={(to) => forward(order.id, to)}
                      onCancel={() => {
                        sendPending();
                        setCancelling({ id: order.id, orderNo: order.orderNo });
                      }}
                    />
                  );
                })
              )}
            </BoardColumn>
          ))}
        </div>
      )}

      {pendingNow && pendingOrder && pendingNow.to !== 'PREPARING' && (
        <UndoToast
          orderNo={pendingOrder.orderNo}
          to={pendingNow.to}
          secondsLeft={Math.max(0, Math.ceil((pendingNow.sendAt - now) / 1000))}
          onUndo={undo}
        />
      )}

      {cancelling && (
        <StaffCancelDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            const done = cancelling;
            setCancelling(null);
            toast({ message: t('cancel.done', { no: done.orderNo }) });
            router.refresh();
          }}
          onRefused={() => {
            setCancelling(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function withoutKey<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
