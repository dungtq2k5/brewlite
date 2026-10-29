import type { OrderStatus, ProductSize } from '@brewlite/contracts';

/** A value the API returns in both supported UI languages (ADR 0031). */
export interface LocalizedText {
  en: string;
  vi: string;
}

/** A menu card row. */
export interface ProductSummary {
  id: string;
  categoryId: string;
  name: LocalizedText;
  imageUrl: string | null;
  fromPriceVnd: number;
  isSoldOut: boolean;
}

/** The product detail page's payload. */
export interface ProductDetail extends ProductSummary {
  description: LocalizedText | null;
  basePriceVnd: number;
  sizes: { size: ProductSize; priceDeltaVnd: number }[];
  toppings: { id: string; name: LocalizedText; priceVnd: number }[];
  maxToppings: number;
}

/** A menu category. */
export interface Category {
  id: string;
  name: LocalizedText;
}

/** One priced line in a quote or an order. */
export interface OrderLine {
  productId: string;
  productName: LocalizedText;
  size: ProductSize;
  toppings: { toppingId: string; name: LocalizedText; priceVnd: number }[];
  unitPriceVnd: number;
  qty: number;
  lineTotalVnd: number;
}

/** The server's authoritative pricing of a cart (api-endpoints-plan §3.1). */
export interface Quote {
  lines: OrderLine[];
  subtotalVnd: number;
  promoDiscountVnd: number;
  pointsDiscountVnd: number;
  totalVnd: number;
  promoCode: string | null;
  pointsEarnable: number;
}

/** An order created from a quote, including its tracking data. */
export interface Order extends Quote {
  id: string;
  orderNo: string;
  status: OrderStatus | string;
  note: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  cancelReason: string | null;
  cancelNote: string | null;
  refundStatus: string;
  pointsEarned: number;
  history: {
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    note: string | null;
    createdAt: string;
  }[];
}

/** A payment attempt for one order (api-endpoints-plan §4). */
export interface Payment {
  id: string;
  orderId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  provider: 'STRIPE' | 'FAKE';
  amountVnd: number;
  method: string | null;
  clientSecret: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** The line shape both quote and place-order requests accept. */
export interface OrderLineInput {
  productId: string;
  size: ProductSize;
  toppingIds: string[];
  qty: number;
}

/** Details the gateway attaches to a known error code (api-endpoints-plan §7). */
export interface ApiErrorDetails {
  productIds?: string[];
  products?: { productId: string; available: number }[];
  lineIndex?: number;
  reason?: string;
  minimumVnd?: number;
  maximumVnd?: number;
  minSubtotalVnd?: number;
  status?: string;
  usedCount?: number;
  balance?: number;
}

/** The customer-facing fields of `/users/me` the pages read. */
export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
  permissions: string[];
  hasPassword: boolean;
  preferredLocale: 'en' | 'vi';
  createdAt: string;
}

/** `/loyalty/me`. */
export interface Loyalty {
  balance: number;
  lifetimeEarned: number;
  recent: {
    orderId: string;
    orderNo: string;
    kind: string;
    points: number;
    at: string;
  }[];
}
