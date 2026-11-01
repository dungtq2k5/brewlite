import { describe, expect, it } from 'vitest';
import {
  customerSees,
  initialStock,
  nextSave,
  shownStock,
  stockReducer,
  type StockAction,
  type StockState,
} from './stock';

const run = (state: StockState, ...actions: StockAction[]) => actions.reduce(stockReducer, state);

describe('customerSees', () => {
  it('names why a product is off sale', () => {
    expect(customerSees(true, null)).toBe('onSale');
    expect(customerSees(true, 5)).toBe('onSale');
    expect(customerSees(false, 5)).toBe('switchedOff');
    expect(customerSees(true, 0)).toBe('countZero');
  });

  it('switched off wins over a count of 0', () => {
    expect(customerSees(false, 0)).toBe('switchedOff');
  });
});

describe('stockReducer', () => {
  const start = initialStock({ stockQty: 5, version: 3 });

  it('sends nothing until something is wanted, or when the want equals the saved count', () => {
    expect(nextSave(start)).toBeNull();
    expect(nextSave(run(start, { type: 'want', value: 5 }))).toBeNull();
  });

  it('sends the wanted count with the saved version', () => {
    expect(nextSave(run(start, { type: 'want', value: 4 }))).toEqual({
      stockQty: 4,
      expectedVersion: 3,
    });
  });

  it('chains three saves, each with the version the previous one returned', () => {
    let s = run(start, { type: 'want', value: 4 });
    expect(nextSave(s)).toEqual({ stockQty: 4, expectedVersion: 3 });
    s = run(s, { type: 'sent' }, { type: 'saved', stockQty: 4, version: 4 });
    s = run(s, { type: 'want', value: 3 });
    expect(nextSave(s)).toEqual({ stockQty: 3, expectedVersion: 4 });
    s = run(s, { type: 'sent' }, { type: 'saved', stockQty: 3, version: 5 });
    s = run(s, { type: 'want', value: null });
    expect(nextSave(s)).toEqual({ stockQty: null, expectedVersion: 5 });
  });

  it('keeps one save in flight: taps while it flies only change what is wanted', () => {
    let s = run(start, { type: 'want', value: 4 }, { type: 'sent' });
    s = run(s, { type: 'want', value: 3 }, { type: 'want', value: 2 });
    expect(nextSave(s)).toBeNull(); // still flying
    expect(shownStock(s)).toBe(2);
    s = run(s, { type: 'saved', stockQty: 4, version: 4 });
    expect(nextSave(s)).toEqual({ stockQty: 2, expectedVersion: 4 }); // only the final value goes
  });

  it('stops when the landed save already is what is wanted', () => {
    const s = run(
      start,
      { type: 'want', value: 4 },
      { type: 'sent' },
      { type: 'saved', stockQty: 4, version: 4 },
    );
    expect(s.wanted).toBeUndefined();
    expect(nextSave(s)).toBeNull();
  });

  it('a conflict resets to the server’s count and retries nothing', () => {
    const s = run(
      start,
      { type: 'want', value: 4 },
      { type: 'sent' },
      { type: 'conflict', currentStockQty: 3, currentVersion: 9 },
    );
    expect(s.saved).toEqual({ stockQty: 3, version: 9 });
    expect(s.conflict).toEqual({ currentStockQty: 3 });
    expect(nextSave(s)).toBeNull();
    expect(shownStock(s)).toBe(3);
  });

  it('the next want clears the conflict line and uses the server’s version', () => {
    let s = run(
      start,
      { type: 'want', value: 4 },
      { type: 'sent' },
      { type: 'conflict', currentStockQty: 3, currentVersion: 9 },
    );
    s = run(s, { type: 'want', value: 6 });
    expect(s.conflict).toBeNull();
    expect(nextSave(s)).toEqual({ stockQty: 6, expectedVersion: 9 });
  });

  it('a failure shows the saved count again and says so', () => {
    const s = run(start, { type: 'want', value: 4 }, { type: 'sent' }, { type: 'failed' });
    expect(s.failed).toBe(true);
    expect(shownStock(s)).toBe(5);
    expect(nextSave(s)).toBeNull();
  });
});
