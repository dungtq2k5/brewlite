/** Why something is off sale — text on the row, never colour alone. */
export type CustomerSees = 'onSale' | 'switchedOff' | 'countZero';

export function customerSees(isAvailable: boolean, stockQty: number | null): CustomerSees {
  if (!isAvailable) return 'switchedOff';
  return stockQty === 0 ? 'countZero' : 'onSale';
}

/** What the server last said about a product's stock. */
export interface StockSaved {
  stockQty: number | null;
  version: number;
}

/**
 * One row's counting. A save carries **the version the previous save returned** — never the page's
 * original — so a barista's own quick taps never conflict with each other. One save is in flight
 * per row; taps while it flies only change `wanted`, and the final value goes out with the new
 * version when it lands. A conflict (someone else changed it) resets to the server's count and
 * retries nothing: a person enters their count again.
 */
export interface StockState {
  saved: StockSaved;
  /** The value the barista wants, or `undefined` when nothing is waiting to be sent. */
  wanted: number | null | undefined;
  inFlight: boolean;
  /** The server's count when this row's last save was refused; shown as the conflict line. */
  conflict: { currentStockQty: number | null } | null;
  /** The last save failed (not a conflict); the row shows an error line. */
  failed: boolean;
}

export type StockAction =
  | { type: 'want'; value: number | null }
  | { type: 'sent' }
  | { type: 'saved'; stockQty: number | null; version: number }
  | { type: 'conflict'; currentStockQty: number | null; currentVersion: number }
  | { type: 'failed' };

export const initialStock = (saved: StockSaved): StockState => ({
  saved,
  wanted: undefined,
  inFlight: false,
  conflict: null,
  failed: false,
});

export function stockReducer(state: StockState, action: StockAction): StockState {
  switch (action.type) {
    case 'want':
      return { ...state, wanted: action.value, conflict: null, failed: false };
    case 'sent':
      return { ...state, inFlight: true };
    case 'saved': {
      const saved = { stockQty: action.stockQty, version: action.version };
      // Taps that came in while this save flew still want their value; otherwise nothing waits.
      const stillWanted = state.wanted !== undefined && state.wanted !== action.stockQty;
      return { ...state, saved, inFlight: false, wanted: stillWanted ? state.wanted : undefined };
    }
    case 'conflict':
      return {
        ...state,
        saved: { stockQty: action.currentStockQty, version: action.currentVersion },
        wanted: undefined,
        inFlight: false,
        conflict: { currentStockQty: action.currentStockQty },
      };
    case 'failed':
      return { ...state, inFlight: false, wanted: undefined, failed: true };
  }
}

/** The save to send now — one at a time, and only when the wanted value differs from the saved. */
export function nextSave(
  state: StockState,
): { stockQty: number | null; expectedVersion: number } | null {
  if (state.inFlight || state.wanted === undefined || state.wanted === state.saved.stockQty)
    return null;
  return { stockQty: state.wanted, expectedVersion: state.saved.version };
}

/** What the row shows as its count: the wanted value while one waits, else the server's. */
export const shownStock = (state: StockState): number | null =>
  state.wanted !== undefined ? state.wanted : state.saved.stockQty;
