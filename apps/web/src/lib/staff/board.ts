import { compareStrings } from '@brewlite/contracts';

/**
 * The order board's rules, apart from React: where a card is, what an overlay is, which order is
 * new, and which stream frames are worth a re-read. The board renders **server data plus local
 * overlays**, so a refresh never undoes what the barista is doing.
 */
export type BoardStatus = 'PAID' | 'PREPARING' | 'READY';
export type MoveTo = 'PREPARING' | 'READY' | 'COMPLETED';

export const BOARD_COLUMNS: readonly BoardStatus[] = ['PAID', 'PREPARING', 'READY'];

/** What the board needs of an order; the real one is the API's `Order`. */
export interface BoardOrder {
  id: string;
  status: string;
  paidAt: string | null;
}

export type Overlay =
  /** A request is out. */
  | { kind: 'inFlight'; to: MoveTo }
  /** Inside the 5 s undo window: shown moved, nothing sent. */
  | { kind: 'pending'; to: MoveTo; sendAt: number }
  /** *Already moved by someone else*, for 5 s; the card is in its real column. */
  | { kind: 'moved'; until: number };

export type Overlays = ReadonlyMap<string, Overlay>;

/** The forward move from a column, or `null` for a status that has none. */
export const nextMove = (status: string): MoveTo | null =>
  status === 'PAID'
    ? 'PREPARING'
    : status === 'PREPARING'
      ? 'READY'
      : status === 'READY'
        ? 'COMPLETED'
        : null;

const isBoardStatus = (status: string): status is BoardStatus =>
  status === 'PAID' || status === 'PREPARING' || status === 'READY';

/**
 * A card's column: its overlay's destination when it has one (`COMPLETED` hides it), else its
 * server status. A `moved` overlay is only an info line — the card stays where the server says.
 */
export function columnOf(order: BoardOrder, overlay: Overlay | undefined): BoardStatus | null {
  if (overlay && overlay.kind !== 'moved') {
    return overlay.to === 'COMPLETED' ? null : overlay.to;
  }
  return isBoardStatus(order.status) ? order.status : null;
}

/** Oldest paid first (the order that has waited longest on top); `id` breaks a tie. */
const byWait = (a: BoardOrder, b: BoardOrder) =>
  compareStrings(a.paidAt ?? '', b.paidAt ?? '') || compareStrings(a.id, b.id);

export function placeOrders<T extends BoardOrder>(
  orders: readonly T[],
  overlays: Overlays,
): Record<BoardStatus, T[]> {
  const columns: Record<BoardStatus, T[]> = { PAID: [], PREPARING: [], READY: [] };
  for (const order of [...orders].sort(byWait)) {
    const column = columnOf(order, overlays.get(order.id));
    if (column) columns[column].push(order);
  }
  return columns;
}

/**
 * Overlays that have done their job: a move whose destination the server now agrees with (or whose
 * order has left the board — it was completed or cancelled), and an info line past its time.
 * A `pending` move is never cleared here: it has not been sent.
 */
export function clearOverlays(
  overlays: Overlays,
  orders: readonly BoardOrder[],
  nowMs: number,
): Map<string, Overlay> {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const kept = new Map<string, Overlay>();
  for (const [id, overlay] of overlays) {
    const order = byId.get(id);
    if (overlay.kind === 'moved') {
      if (overlay.until > nowMs && order) kept.set(id, overlay);
    } else if (overlay.kind === 'inFlight') {
      if (order && order.status !== overlay.to) kept.set(id, overlay);
    } else if (order) {
      kept.set(id, overlay);
    }
  }
  return kept;
}

/** The one move waiting out its undo window, if any — there is never more than one. */
export function pendingMove(
  overlays: Overlays,
): { id: string; to: MoveTo; sendAt: number } | undefined {
  for (const [id, overlay] of overlays) {
    if (overlay.kind === 'pending') return { id, to: overlay.to, sendAt: overlay.sendAt };
  }
  return undefined;
}

/** Ids in `PAID` now that the board did not hold in its previous data; the first data has none. */
export function newOrderIds(
  previous: readonly Pick<BoardOrder, 'id'>[] | null,
  next: readonly BoardOrder[],
): string[] {
  if (previous === null) return [];
  const known = new Set(previous.map((o) => o.id));
  return next.filter((o) => o.status === 'PAID' && !known.has(o.id)).map((o) => o.id);
}

/**
 * Whether a stream frame is worth re-reading the board for. The stream carries every order's
 * changes — a customer placing or starting a payment must not refresh every tablet. Only a frame
 * into a board status, or about an order that is on the board (it left: completed, cancelled).
 */
export function isRelevantFrame(
  frame: { orderId: string; status: string },
  onBoard: ReadonlySet<string>,
): boolean {
  return isBoardStatus(frame.status) || onBoard.has(frame.orderId);
}
