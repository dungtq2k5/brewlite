import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffOrdersBoard } from './StaffOrdersBoard';
import { OrderDetailsDrawer } from './OrderDetailsDrawer';
import { StaffLanguageProvider } from '../i18n';
import { advanceStaffOrder, cancelStaffOrder } from '@/lib/staff/actions';
import type { Order } from '@/lib/staff/contracts';
vi.mock('@/lib/staff/actions', () => ({ advanceStaffOrder: vi.fn(), cancelStaffOrder: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const order: Order = {
  id: 'test-order',
  orderNo: 'TEST-42',
  status: 'PAID',
  subtotalVnd: 41000,
  promoDiscountVnd: 1000,
  pointsDiscountVnd: 0,
  totalVnd: 40000,
  promoCode: ['TEST'],
  pointsEarnable: 0,
  note: ['Keep original note'],
  expiresAt: [],
  paidAt: ['2026-10-18T00:00:00Z'],
  createdAt: '2026-10-18T00:00:00Z',
  cancelReason: [],
  cancelNote: [],
  refundStatus: 'NONE',
  pointsEarned: 0,
  history: [],
  lines: [
    {
      productId: 'coffee',
      productName: { en: 'Coffee', vi: 'Cà phê' },
      size: 'M',
      toppings: [],
      qty: 2,
      unitPriceVnd: 20000,
      lineTotalVnd: 41000,
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
describe('orders UI with generated-contract fixtures', () => {
  it('uses backend subtotal and line total directly', () => {
    render(<OrderDetailsDrawer order={order} onClose={vi.fn()} />);
    expect(screen.getAllByText('₫41,000')).toHaveLength(2);
    expect(screen.getByText('₫40,000')).toBeTruthy();
    expect(screen.getByText('Keep original note')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '#TEST-42' })).toBeTruthy();
  });
  it('hides mutations without permissions while keeping details available', () => {
    render(<StaffOrdersBoard initial={{ ok: true, data: [order] }} permissions={[]} />);
    expect(screen.getByRole('button', { name: 'Details' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start preparing' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
  });
  it('does not show mock orders on API failure', () => {
    render(<StaffOrdersBoard initial={{ ok: false, error: 'requestFailed' }} permissions={[]} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load or save');
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
  });
  it('sends backend transition code and shows server errors', async () => {
    vi.mocked(advanceStaffOrder).mockResolvedValue({ ok: false, error: 'invalidState' });
    render(
      <StaffOrdersBoard
        initial={{ ok: true, data: [order] }}
        permissions={['order.status.update']}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start preparing' }));
    await screen.findByRole('alert');
    expect(advanceStaffOrder).toHaveBeenCalledWith(order.id, { to: 'PREPARING' });
    expect(screen.queryByText('Order updated.')).toBeNull();
  });
  it('locks cancellation, prevents escape, and renders actual refund status', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof cancelStaffOrder>>) => void;
    vi.mocked(cancelStaffOrder).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <StaffLanguageProvider>
        <StaffOrdersBoard
          initial={{ ok: true, data: [order] }}
          permissions={['order.cancel.paid']}
        />
      </StaffLanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unavailable today' } });
    const dialog = screen.getByRole('dialog');
    const form = dialog.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(cancelStaffOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBe(dialog);
    await act(async () =>
      resolve({ ok: true, data: { ...order, status: 'CANCELLED', refundStatus: 'FAILED' } }),
    );
    await waitFor(() => expect(screen.getByText('Refund failed')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Order #TEST-42 cancelled' })).toBeTruthy();
  });
});
