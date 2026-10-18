'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_COLUMNS } from './order.constants';
import { ordersApi } from './orders-api';
import type { Order, Result } from '@/lib/staff/contracts';
import type { OrderStats } from './order.types';
export function useStaffOrders(initial: Result<Order[]>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const orders = initial.ok ? initial.data : [];
  const stats: OrderStats = {
    paid: orders.filter((order) => order.status === 'PAID').length,
    preparing: orders.filter((order) => order.status === 'PREPARING').length,
    ready: orders.filter((order) => order.status === 'READY').length,
    processing: orders.length,
  };
  function refreshOrders() {
    if (locked.current || pending) return;
    setError('');
    setNotice('');
    startTransition(() => router.refresh());
  }
  async function mutate(id: string, note?: string): Promise<Order> {
    if (locked.current || pending) throw new Error('requestFailed');
    const order = orders.find((order) => order.id === id);
    const column = ORDER_COLUMNS.find((column) => column.status === order?.status);
    if (!order || !column || (note !== undefined && order.status !== 'PAID'))
      throw new Error('invalidState');
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result =
        note === undefined
          ? await ordersApi.advance(id, { to: column.nextStatus })
          : await ordersApi.cancel(id, { note });
      if (!result.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      setNotice('Đã cập nhật đơn hàng.');
      return result.data;
    } catch (cause) {
      if (
        !(cause instanceof Error) ||
        ![
          'requestFailed',
          'unauthenticated',
          'forbidden',
          'invalidState',
          'invalidInput',
          'notFound',
        ].includes(cause.message)
      ) {
        setError('requestFailed');
        throw new Error('requestFailed');
      }
      throw cause;
    } finally {
      locked.current = false;
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }
  async function advanceOrder(id: string) {
    try {
      await mutate(id);
    } catch {
      return;
    }
  }
  return {
    orders,
    stats,
    notice,
    error: error || (!initial.ok ? initial.error : ''),
    busy: busy || pending,
    advanceOrder,
    cancelOrder: (id: string, reason: string) => mutate(id, reason),
    refreshOrders,
  };
}
