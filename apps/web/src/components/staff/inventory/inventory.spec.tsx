import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryWorkspace } from './InventoryWorkspace';
import { QuantityDialog } from './QuantityDialog';
import { StaffLanguageProvider, STAFF_LANGUAGE_KEY } from '../i18n';
import type { InventoryProduct } from '@/lib/staff/contracts';
import {
  refreshInventory,
  saveInventoryQuantity,
  setInventoryAvailability,
} from '@/lib/staff/actions';
vi.mock('@/lib/staff/actions', () => ({
  refreshInventory: vi.fn(),
  saveInventoryQuantity: vi.fn(),
  setInventoryAvailability: vi.fn(),
}));
const product = (overrides: Partial<InventoryProduct> = {}): InventoryProduct => ({
  id: '01990000-0000-7000-8000-000000000001',
  categoryId: 'coffee',
  name: { en: 'Coffee', vi: 'Cà phê' },
  isAvailable: true,
  stockQty: 10,
  version: 0,
  ...overrides,
});
function setup(initial = product()) {
  const data = { products: [initial], toppings: [] };
  vi.mocked(refreshInventory).mockResolvedValue({ ok: true, data });
  render(
    <StaffLanguageProvider>
      <InventoryWorkspace initial={{ ok: true, data }} />
    </StaffLanguageProvider>,
  );
  return data;
}
async function open() {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit quantity for Coffee' }));
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
describe('inventory Server Action integration', () => {
  it('shows empty states for successful empty inventory without an error', () => {
    render(<InventoryWorkspace initial={{ ok: true, data: { products: [], toppings: [] } }} />);
    expect(screen.getByText('No products yet.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Toppings' }));
    expect(screen.getByText('No toppings yet.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(refreshInventory).not.toHaveBeenCalled();
  });
  it('keeps failed initial loading distinct from a successful empty result', () => {
    render(<InventoryWorkspace initial={{ ok: false, error: 'requestFailed' }} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load or save');
    expect(screen.queryByText('No products yet.')).toBeNull();
    expect(screen.getByText('Could not load data. Refresh to try again.')).toBeTruthy();
  });
  it('uses server data without a browser fetch, and preserves untracked stock', async () => {
    setup(product({ stockQty: null }));
    expect(refreshInventory).not.toHaveBeenCalled();
    await open();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('available');
    vi.mocked(saveInventoryQuantity).mockResolvedValue({
      ok: true,
      data: product({ stockQty: null, isAvailable: false }),
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'unavailable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save quantity' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saveInventoryQuantity).toHaveBeenCalledWith(
      product().id,
      { stockQty: null, expectedVersion: 0 },
      false,
    );
  });
  it('accepts zero and never turns availability on implicitly on restock', async () => {
    setup();
    await open();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('unavailable');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('unavailable');
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } });
    vi.mocked(saveInventoryQuantity).mockResolvedValue({
      ok: true,
      data: product({ stockQty: 0, isAvailable: false, version: 1 }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save quantity' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saveInventoryQuantity).toHaveBeenCalledWith(
      product().id,
      { stockQty: 0, expectedVersion: 0 },
      false,
    );
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(['-1', '1.5', '2147483648', ''])(
    'rejects invalid quantity %j on programmatic submit',
    (value) => {
      const save = vi.fn();
      render(<QuantityDialog product={product()} onSave={save} onClose={vi.fn()} />);
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value } });
      fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
      expect(save).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toContain('whole number');
    },
  );
  it('reconciles conflicts and retries with the latest version without false success', async () => {
    setup();
    await open();
    vi.mocked(saveInventoryQuantity).mockResolvedValueOnce({ ok: false, error: 'conflict' });
    vi.mocked(refreshInventory).mockResolvedValue({
      ok: true,
      data: { products: [product({ version: 2, stockQty: 4, isAvailable: false })], toppings: [] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save quantity' }));
    await within(screen.getByRole('dialog')).findByRole('alert');
    expect(screen.queryByText('Quantity updated.')).toBeNull();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    vi.mocked(saveInventoryQuantity).mockResolvedValue({ ok: true, data: product({ version: 3 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Save quantity' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saveInventoryQuantity).toHaveBeenLastCalledWith(
      product().id,
      { stockQty: 10, expectedVersion: 2 },
      true,
    );
  });
  it('blocks writes when reconciliation fails and recovers through refresh', async () => {
    setup();
    await open();
    vi.mocked(saveInventoryQuantity).mockResolvedValue({ ok: false, error: 'requestFailed' });
    vi.mocked(refreshInventory).mockResolvedValueOnce({ ok: false, error: 'requestFailed' });
    fireEvent.click(screen.getByRole('button', { name: 'Save quantity' }));
    await within(screen.getByRole('dialog')).findByRole('alert');
    expect(
      (screen.getByRole('button', { name: 'Save quantity' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(false),
    );
  });
  it('prevents duplicate submit, escape and close during a pending mutation', async () => {
    setup();
    await open();
    let resolve!: (value: Awaited<ReturnType<typeof saveInventoryQuantity>>) => void;
    vi.mocked(saveInventoryQuantity).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const dialog = screen.getByRole('dialog');
    const form = dialog.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(saveInventoryQuantity).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBe(dialog);
    await act(async () => resolve({ ok: true, data: product({ version: 1 }) }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('serializes availability toggles and never exposes an internal exception', async () => {
    setup();
    vi.mocked(setInventoryAvailability).mockRejectedValue(
      new Error('private gateway host and secret'),
    );
    fireEvent.click(screen.getByRole('switch'));
    await screen.findByRole('alert');
    expect(screen.queryByText(/private gateway/)).toBeNull();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
  it('restores Vietnamese for existing inventory UI', async () => {
    localStorage.setItem(STAFF_LANGUAGE_KEY, 'vi');
    setup();
    expect(await screen.findByRole('heading', { name: 'Tồn kho' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chỉnh số lượng Cà phê' })).toBeTruthy();
  });
});
