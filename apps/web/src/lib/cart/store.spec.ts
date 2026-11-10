import { describe, expect, it, vi } from 'vitest';
import { newLine } from './fixtures';
import { createCartStorage, type StorageLike } from './storage';
import { createCartStore } from './store';

const memory = (): StorageLike => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

describe('the cart store', () => {
  it('is not ready until it has read storage, and the server snapshot is never ready', () => {
    const store = createCartStore(createCartStorage(() => memory()));
    expect(store.getSnapshot().ready).toBe(false);
    expect(store.getServerSnapshot().ready).toBe(false);
    store.load();
    expect(store.getSnapshot()).toMatchObject({ ready: true, cart: { lines: [] } });
  });

  it('persists every change and a second store (another tab) reads it', () => {
    const storage = memory();
    const a = createCartStore(createCartStorage(() => storage));
    a.load();
    a.add(newLine(), 2);
    const b = createCartStore(createCartStorage(() => storage));
    b.load();
    expect(b.getSnapshot().cart.lines[0]!.quantity).toBe(2);
  });

  it('notifies subscribers, and keeps the snapshot identity while nothing changes', () => {
    const store = createCartStore(createCartStorage(() => memory()));
    store.load();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    store.setQuantity('unknown', 3);
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    store.add(newLine(), 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('works in memory when storage throws, and says nothing', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const store = createCartStore(
      createCartStorage(() => ({ getItem: boom, setItem: boom, removeItem: boom })),
    );
    store.load();
    expect(store.add(newLine(), 2).added).toBe(2);
    expect(store.getSnapshot().cart.lines).toHaveLength(1);
    store.reload(); // clearCart() with unreadable storage: the memory cart goes too
    expect(store.getSnapshot().cart.lines).toHaveLength(0);
  });

  it('a change before the first read keeps what was stored instead of overwriting it', () => {
    const storage = memory();
    const first = createCartStore(createCartStorage(() => storage));
    first.load();
    first.add(newLine(), 2);
    const early = createCartStore(createCartStorage(() => storage)); // never `load()`ed
    early.add(newLine({ productId: 'p2' }), 1);
    expect(early.getSnapshot().cart.lines.map((l) => l.productId)).toEqual(['p1', 'p2']);
  });

  it('marks the cart placed and clears it only for that order', () => {
    const store = createCartStore(createCartStorage(() => memory()));
    store.load();
    store.add(newLine(), 2);
    store.markPlaced('order-1');
    store.clearIfPlaced('order-0');
    expect(store.getSnapshot().cart.lines).toHaveLength(1);
    store.clearIfPlaced('order-1');
    expect(store.getSnapshot().cart.lines).toHaveLength(0);
  });

  it('the marker survives a reload and is dropped by an edit', () => {
    const storage = memory();
    const a = createCartStore(createCartStorage(() => storage));
    a.load();
    a.add(newLine(), 2);
    a.markPlaced('order-1');
    const b = createCartStore(createCartStorage(() => storage));
    b.load();
    expect(b.getSnapshot().cart.placedOrderId).toBe('order-1');
    b.setQuantity(b.getSnapshot().cart.lines[0]!.key, 3);
    expect(b.getSnapshot().cart.placedOrderId).toBeUndefined();
  });

  it('undo puts the line back', () => {
    const store = createCartStore(createCartStorage(() => memory()));
    store.load();
    store.add(newLine(), 3);
    const key = store.getSnapshot().cart.lines[0]!.key;
    const { removed } = store.remove(key);
    expect(store.getSnapshot().cart.lines).toHaveLength(0);
    store.restore(removed!.line, removed!.index);
    expect(store.getSnapshot().cart.lines[0]!.quantity).toBe(3);
  });
});
