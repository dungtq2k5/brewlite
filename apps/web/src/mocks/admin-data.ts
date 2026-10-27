import type { LocalizedText } from '@/i18n/format';

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface MockUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
  preferredLocale: 'vi' | 'en';
  hasPassword: boolean;
  isLocked: boolean;
  lockReason: string | null;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  deletedById?: string | null;
  createdAt: string;
}

export interface MockCategory {
  id: string;
  name: LocalizedText;
  sortOrder: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface MockTopping {
  id: string;
  name: LocalizedText;
  priceVnd: number;
  isAvailable: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export interface MockProductSize {
  size: 'S' | 'M' | 'L';
  priceDeltaVnd: number;
}

export interface MockProduct {
  id: string;
  categoryId: string;
  name: LocalizedText;
  description: LocalizedText;
  basePriceVnd: number;
  sortOrder: number;
  imageUrl: string | null;
  isAvailable: boolean;
  stockQty: number | null; // Khớp chính xác DTO Backend (stockQty)
  version: number;
  sizes: MockProductSize[];
  toppingIds: string[];
  createdAt: string;
  deletedAt: string | null;
}

export type DiscountType = 'PERCENT' | 'FIXED';

export interface MockPromotion {
  id: string;
  code: string;
  description: string | null; // Khớp chính xác DTO Backend (string đơn, không phải LocalizedText)
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd: number | null;
  minSubtotalVnd: number; // Khớp chính xác DTO Backend (minSubtotalVnd)
  startsAt: string;
  endsAt: string;
  maxUses: number | null; // Khớp chính xác DTO Backend (maxUses)
  perUserLimit: number | null; // Khớp chính xác DTO Backend (perUserLimit)
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export type OrderStatus = 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface MockOrderLine {
  productName: LocalizedText;
  size: 'S' | 'M' | 'L';
  quantity: number;
  unitPriceVnd: number;
}

export interface MockOrder {
  id: string;
  orderNo: string; // Khớp chính xác OrderResponseDto (orderNo)
  customerName: string;
  status: OrderStatus;
  subtotalVnd: number;
  promoDiscountVnd: number;
  pointsDiscountVnd: number;
  totalVnd: number;
  lines: MockOrderLine[];
  cancelNote: string | null;
  refundStatus: string;
  createdAt: string;
}

export const CURRENT_ADMIN_ID = '019283a1-0001-7000-8000-000000000001';

export const ROLE_PERMISSIONS_MAP: Record<UserRole, string[]> = {
  ADMIN: [
    'users:read',
    'users:write',
    'catalog:write',
    'promotions:write',
    'orders:manage',
    'inventory:write',
  ],
  STAFF: ['orders:manage', 'inventory:write'],
  CUSTOMER: ['orders:create', 'loyalty:read'],
};

export const MOCK_USERS: MockUser[] = [
  {
    id: CURRENT_ADMIN_ID,
    email: 'admin@brewlite.local',
    fullName: 'Nguyễn Quản Trị',
    role: 'ADMIN',
    permissions: ROLE_PERMISSIONS_MAP.ADMIN,
    preferredLocale: 'vi',
    hasPassword: true,
    isLocked: false,
    lockReason: null,
    lockedUntil: null,
    lastLoginAt: '2026-10-14T08:30:00.000Z',
    deletedAt: null,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: '019283a1-0002-7000-8000-000000000002',
    email: 'admin2@brewlite.local',
    fullName: 'Đặng Quản Trị Viên 2',
    role: 'ADMIN',
    permissions: ROLE_PERMISSIONS_MAP.ADMIN,
    preferredLocale: 'en',
    hasPassword: true,
    isLocked: false,
    lockReason: null,
    lockedUntil: null,
    lastLoginAt: '2026-10-13T19:10:00.000Z',
    deletedAt: null,
    createdAt: '2026-09-28T09:00:00.000Z',
  },
  {
    id: '019283a1-0003-7000-8000-000000000003',
    email: 'staff01@brewlite.local',
    fullName: 'Trần Pha Chế Ca Sáng',
    role: 'STAFF',
    permissions: ROLE_PERMISSIONS_MAP.STAFF,
    preferredLocale: 'vi',
    hasPassword: true,
    isLocked: false,
    lockReason: null,
    lockedUntil: null,
    lastLoginAt: '2026-10-14T06:00:00.000Z',
    deletedAt: null,
    createdAt: '2026-10-01T09:15:00.000Z',
  },
  {
    id: '019283a1-0004-7000-8000-000000000004',
    email: 'customer.vip@gmail.com',
    fullName: 'Lê Khách Hàng Thân Thiết',
    role: 'CUSTOMER',
    permissions: ROLE_PERMISSIONS_MAP.CUSTOMER,
    preferredLocale: 'vi',
    hasPassword: false,
    isLocked: false,
    lockReason: null,
    lockedUntil: null,
    lastLoginAt: '2026-10-14T07:45:00.000Z',
    deletedAt: null,
    createdAt: '2026-10-03T14:30:00.000Z',
  },
  {
    id: '019283a1-0005-7000-8000-000000000005',
    email: 'spam.order@gmail.com',
    fullName: 'Phạm Tài Khoản Bị Khóa',
    role: 'CUSTOMER',
    permissions: ROLE_PERMISSIONS_MAP.CUSTOMER,
    preferredLocale: 'vi',
    hasPassword: true,
    isLocked: true,
    lockReason: 'Đặt đơn ảo liên tục không thanh toán quá 5 lần',
    lockedUntil: '2026-11-01T00:00:00.000Z',
    lastLoginAt: '2026-10-08T11:00:00.000Z',
    deletedAt: null,
    createdAt: '2026-10-05T11:20:00.000Z',
  },
  {
    id: '019283a1-0006-7000-8000-000000000006',
    email: 'former.staff@brewlite.local',
    fullName: 'Võ Nhân Viên Đã Nghỉ',
    role: 'STAFF',
    permissions: ROLE_PERMISSIONS_MAP.STAFF,
    preferredLocale: 'vi',
    hasPassword: true,
    isLocked: true,
    lockReason: 'Khóa bảo mật khi bàn giao ca',
    lockedUntil: null,
    lastLoginAt: '2026-10-02T17:00:00.000Z',
    deletedAt: '2026-10-10T10:00:00.000Z',
    createdAt: '2026-09-29T10:00:00.000Z',
  },
];

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: 'cat-1',
    name: { en: 'Coffee', vi: 'Cà phê' },
    sortOrder: 1,
    isActive: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 'cat-2',
    name: { en: 'Tea & Milk Tea', vi: 'Trà' },
    sortOrder: 2,
    isActive: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:05:00.000Z',
  },
  {
    id: 'cat-3',
    name: { en: 'Bakery', vi: 'Bánh ngọt' },
    sortOrder: 3,
    isActive: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:10:00.000Z',
  },
  {
    id: 'cat-4',
    name: { en: 'Seasonal Specials', vi: 'Món theo mùa' },
    sortOrder: 4,
    isActive: false,
    deletedAt: '2026-10-12T00:00:00.000Z',
    createdAt: '2026-09-25T08:15:00.000Z',
  },
];

export const MOCK_TOPPINGS: MockTopping[] = [
  {
    id: 'top-1',
    name: { en: 'Coffee Jelly', vi: 'Thạch cà phê' },
    priceVnd: 8000,
    isAvailable: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 'top-2',
    name: { en: 'Cheese Foam', vi: 'Kem phô mai' },
    priceVnd: 12000,
    isAvailable: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 'top-3',
    name: { en: 'Black Pearl', vi: 'Trân châu' },
    priceVnd: 10000,
    isAvailable: true,
    deletedAt: null,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 'top-4',
    name: { en: 'White Crystal Pearl', vi: 'Trân châu trắng' },
    priceVnd: 10000,
    isAvailable: false,
    deletedAt: '2026-10-09T00:00:00.000Z',
    createdAt: '2026-09-25T08:00:00.000Z',
  },
];

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 'prod-1',
    categoryId: 'cat-1',
    name: { en: 'Saigon Iced Milk Coffee', vi: 'Cà phê sữa đá Sài Gòn' },
    description: {
      en: 'Traditional phin filter coffee with rich condensed milk',
      vi: 'Phin truyền thống, sữa đặc béo thơm',
    },
    basePriceVnd: 29000,
    sortOrder: 1,
    imageUrl: null,
    isAvailable: true,
    stockQty: 45,
    version: 1,
    sizes: [
      { size: 'S', priceDeltaVnd: 0 },
      { size: 'M', priceDeltaVnd: 6000 },
      { size: 'L', priceDeltaVnd: 10000 },
    ],
    toppingIds: ['top-1', 'top-2'],
    createdAt: '2026-10-01T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'prod-2',
    categoryId: 'cat-2',
    name: { en: 'Roasted Almond Cheese Jasmine Tea', vi: 'Trà lài kem phô mai hạnh nhân nướng' },
    description: {
      en: 'Fragrant jasmine tea topped with creamy cheese foam and roasted almonds',
      vi: 'Trà lài ủ hoa thanh, lớp kem béo mặn cùng hạnh nhân',
    },
    basePriceVnd: 39000,
    sortOrder: 2,
    imageUrl: null,
    isAvailable: true,
    stockQty: null,
    version: 3,
    sizes: [
      { size: 'S', priceDeltaVnd: 0 },
      { size: 'M', priceDeltaVnd: 6000 },
      { size: 'L', priceDeltaVnd: 10000 },
    ],
    toppingIds: ['top-1', 'top-2', 'top-3'],
    createdAt: '2026-10-02T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'prod-3',
    categoryId: 'cat-3',
    name: { en: 'French Butter Croissant', vi: 'Bánh croissant bơ Pháp' },
    description: {
      en: 'Flaky golden pastry baked with French butter',
      vi: 'Bánh sừng bò ngàn lớp nướng bơ Pháp thơm lừng',
    },
    basePriceVnd: 35000,
    sortOrder: 3,
    imageUrl: null,
    isAvailable: false,
    stockQty: 0,
    version: 2,
    sizes: [{ size: 'M', priceDeltaVnd: 0 }],
    toppingIds: [],
    createdAt: '2026-10-03T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'prod-4',
    categoryId: 'cat-4',
    name: { en: 'Pumpkin Spice Latte', vi: 'Latte Bí Đỏ' },
    description: {
      en: 'Autumn special pumpkin latte',
      vi: 'Món đặc biệt mùa thu thuộc danh mục đã xóa mềm',
    },
    basePriceVnd: 55000,
    sortOrder: 4,
    imageUrl: null,
    isAvailable: false,
    stockQty: 10,
    version: 1,
    sizes: [{ size: 'M', priceDeltaVnd: 0 }],
    toppingIds: [],
    createdAt: '2026-10-04T08:00:00.000Z',
    deletedAt: '2026-10-12T00:00:00.000Z',
  },
];

export const MOCK_PROMOTIONS: MockPromotion[] = [
  {
    id: 'promo-1',
    code: 'BREW20',
    description: 'Giảm 20.000 đ cho đơn từ 60.000 đ / 20k VND off orders from 60k',
    discountType: 'FIXED',
    discountValue: 20000,
    maxDiscountVnd: null,
    minSubtotalVnd: 60000,
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
    maxUses: 500,
    perUserLimit: 1,
    usedCount: 142,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'promo-2',
    code: 'WELCOME15',
    description: 'Giảm 15% tối đa 30.000 đ cho đơn từ 50.000 đ',
    discountType: 'PERCENT',
    discountValue: 15,
    maxDiscountVnd: 30000,
    minSubtotalVnd: 50000,
    startsAt: '2026-10-05T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:59.000Z',
    maxUses: null,
    perUserLimit: 3,
    usedCount: 58,
    isActive: true,
    createdAt: '2026-10-05T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'promo-3',
    code: 'MIDAUTUMN50',
    description: 'Khuyến mãi Trung Thu (Đã ngưng)',
    discountType: 'PERCENT',
    discountValue: 50,
    maxDiscountVnd: 50000,
    minSubtotalVnd: 120000,
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-09-30T23:59:59.000Z',
    maxUses: 100,
    perUserLimit: 1,
    usedCount: 100,
    isActive: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    deletedAt: '2026-10-01T00:00:00.000Z',
  },
];

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: 'ord-1',
    orderNo: '1042',
    customerName: 'Lê Khách Hàng',
    status: 'PAID',
    subtotalVnd: 102000,
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: 102000,
    lines: [
      {
        productName: { vi: 'Cà phê sữa đá Sài Gòn', en: 'Saigon Iced Milk Coffee' },
        size: 'L',
        quantity: 1,
        unitPriceVnd: 47000,
      },
      {
        productName: {
          vi: 'Trà lài kem phô mai hạnh nhân nướng',
          en: 'Roasted Almond Cheese Jasmine Tea',
        },
        size: 'M',
        quantity: 1,
        unitPriceVnd: 55000,
      },
    ],
    cancelNote: null,
    refundStatus: 'NONE',
    createdAt: '2026-10-14T09:15:00.000Z',
  },
  {
    id: 'ord-2',
    orderNo: '1043',
    customerName: 'Trần Minh Anh',
    status: 'PREPARING',
    subtotalVnd: 55000,
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: 55000,
    lines: [
      {
        productName: {
          vi: 'Trà lài kem phô mai hạnh nhân nướng',
          en: 'Roasted Almond Cheese Jasmine Tea',
        },
        size: 'M',
        quantity: 1,
        unitPriceVnd: 55000,
      },
    ],
    cancelNote: null,
    refundStatus: 'NONE',
    createdAt: '2026-10-14T09:20:00.000Z',
  },
  {
    id: 'ord-3',
    orderNo: '1044',
    customerName: 'Nguyễn Hoàng Nam',
    status: 'READY',
    subtotalVnd: 94000,
    promoDiscountVnd: 0,
    pointsDiscountVnd: 0,
    totalVnd: 94000,
    lines: [
      {
        productName: { vi: 'Cà phê sữa đá Sài Gòn', en: 'Saigon Iced Milk Coffee' },
        size: 'L',
        quantity: 2,
        unitPriceVnd: 47000,
      },
    ],
    cancelNote: null,
    refundStatus: 'NONE',
    createdAt: '2026-10-14T09:10:00.000Z',
  },
];