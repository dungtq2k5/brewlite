'use client';

import { useState } from 'react';
import { ORDER_COLUMNS } from './order.constants';
import { initialOrders } from './order.mock';
import type { Order, OrderStats } from './order.types';

export function useStaffOrders() {
  const [orders, setOrders] = useState<Order[]>(() => initialOrders.map((order) => ({ ...order })));
  const [notice, setNotice] = useState('');

  const stats: OrderStats = {
    paid: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    processing: 0,
  };

  for (const order of orders) {
    switch (order.status) {
      case 'PAID':
        stats.paid += 1;
        break;
      case 'PREPARING':
        stats.preparing += 1;
        break;
      case 'READY':
        stats.ready += 1;
        break;
      case 'COMPLETED':
        stats.completed += 1;
        break;
    }
  }

  stats.processing = stats.paid + stats.preparing + stats.ready;

  function advanceOrder(orderId: string) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) return order;

        const column = ORDER_COLUMNS.find((item) => item.status === order.status);

        if (!column) return order;

        return {
          ...order,
          status: column.nextStatus,
        };
      }),
    );

    setNotice('Thay đổi chỉ được lưu trong phiên xem hiện tại.');
  }

  function cancelOrder(orderId: string, reason: string) {
    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length > 200) return;

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId && order.status === 'PAID'
          ? {
              ...order,
              status: 'CANCELLED',
              cancelReason: trimmedReason,
            }
          : order,
      ),
    );

    setNotice(`Đã cập nhật bản demo cho đơn #${orderId}. Thay đổi chỉ lưu trong phiên hiện tại.`);
  }

  function refreshOrders() {
    setOrders(initialOrders.map((order) => ({ ...order })));
    setNotice('Đã làm mới bảng đơn từ dữ liệu mẫu.');
  }

  return {
    orders,
    stats,
    notice,
    advanceOrder,
    cancelOrder,
    refreshOrders,
  };
}
