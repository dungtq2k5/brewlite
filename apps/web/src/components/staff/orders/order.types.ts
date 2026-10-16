export type OrderStatus =
  'PENDING' | 'PAYMENT_FAILED' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type BoardStatus = Extract<OrderStatus, 'PAID' | 'PREPARING' | 'READY'>;

export type OrderFilter = 'all' | BoardStatus;

export type OrderTopping = {
  id: string;
  name: string;
  priceVnd?: number;
};

export type OrderLine = {
  id: string;
  productId: string;
  item: string;
  size: string;
  quantity: number;
  toppings:
    [] | [OrderTopping] | [OrderTopping, OrderTopping] | [OrderTopping, OrderTopping, OrderTopping];
  note?: string;
  unitPriceVnd?: number;
  lineTotalVnd?: number;
};

export type Order = {
  id: string;
  time: string;
  paidAt: string;
  lines: OrderLine[];
  total: string;
  status: OrderStatus;
  note?: string;
  cancelReason?: string;
  promoCode?: string;
  promoDiscountVnd?: number;
  pointsDiscountVnd?: number;
};

export type OrderColumnConfig = {
  status: BoardStatus;
  title: string;
  action: string;
  nextStatus: Extract<OrderStatus, 'PREPARING' | 'READY' | 'COMPLETED'>;
};

export type OrderStats = {
  paid: number;
  preparing: number;
  ready: number;
  completed: number;
  processing: number;
};
