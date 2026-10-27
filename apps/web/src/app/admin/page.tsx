import {
  adminCategoriesControllerList,
  adminProductsControllerList,
  adminToppingsControllerList,
  adminUsersControllerList,
  promotionsControllerList,
  staffOrdersControllerListBoard,
  type AdminCategoryResponseDto,
  type AdminProductListItemResponseDto,
  type AdminToppingResponseDto,
  type AdminUserResponseDto,
  type OrderResponseDto,
  type PromotionResponseDto,
} from '@brewlite/api-client';
import { handlePageApiError, requireServerAuth } from '@/lib/api-server';
import { unwrapNullable } from '@/lib/zod-schemas';
import type { MockCategory, MockOrder, MockProduct, MockPromotion, MockTopping, MockUser, OrderStatus } from '@/mocks/admin-data';
import { DashboardClient } from './dashboard-client';

export default async function AdminDashboardPage() {
  await requireServerAuth();
  try {
    const [usersRes, catRes, topRes, prodRes, promoRes, ordRes] = await Promise.all([
      adminUsersControllerList({ deleted: 'false' }),
      adminCategoriesControllerList({ deleted: 'false' }),
      adminToppingsControllerList({ deleted: 'false' }),
      adminProductsControllerList({ deleted: 'false' }),
      promotionsControllerList({ deleted: 'false' }),
      staffOrdersControllerListBoard(),
    ]);

    const users: MockUser[] = ((usersRes.data as unknown as { data?: AdminUserResponseDto[] })?.data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      permissions: u.permissions,
      preferredLocale: u.preferredLocale,
      hasPassword: u.hasPassword,
      isLocked: u.isLocked,
      lockReason: unwrapNullable(u.lockReason),
      lockedUntil: unwrapNullable(u.lockedUntil),
      lastLoginAt: unwrapNullable(u.lastLoginAt),
      deletedAt: unwrapNullable(u.deletedAt),
      createdAt: u.createdAt,
    }));

    const categories: MockCategory[] = ((catRes.data as unknown as { data?: AdminCategoryResponseDto[] })?.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      deletedAt: unwrapNullable(c.deletedAt),
      createdAt: c.createdAt,
    }));

    const toppings: MockTopping[] = ((topRes.data as unknown as { data?: AdminToppingResponseDto[] })?.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      priceVnd: t.priceVnd,
      isAvailable: t.isAvailable,
      deletedAt: unwrapNullable(t.deletedAt),
      createdAt: t.createdAt,
    }));

    const products: MockProduct[] = ((prodRes.data as unknown as { data?: AdminProductListItemResponseDto[] })?.data ?? []).map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      description: { vi: '', en: '' },
      basePriceVnd: p.basePriceVnd,
      sortOrder: p.sortOrder,
      imageUrl: unwrapNullable(p.imageUrl),
      isAvailable: p.isAvailable,
      stockQty: p.stockQty,
      version: p.version,
      sizes: [{ size: 'M', priceDeltaVnd: 0 }],
      toppingIds: [],
      createdAt: p.createdAt,
      deletedAt: unwrapNullable(p.deletedAt),
    }));

    const promotions: MockPromotion[] = ((promoRes.data as unknown as { data?: PromotionResponseDto[] })?.data ?? []).map((pr) => ({
      id: pr.id,
      code: pr.code,
      description: unwrapNullable(pr.description),
      discountType: pr.discountType,
      discountValue: pr.discountValue,
      maxDiscountVnd: pr.maxDiscountVnd,
      minSubtotalVnd: pr.minSubtotalVnd,
      startsAt: pr.startsAt,
      endsAt: pr.endsAt,
      maxUses: unwrapNullable(pr.maxUses),
      perUserLimit: unwrapNullable(pr.perUserLimit),
      usedCount: pr.usedCount,
      isActive: pr.isActive,
      createdAt: pr.createdAt,
      deletedAt: unwrapNullable((pr as unknown as { deletedAt?: string | string[] | null }).deletedAt),
    }));

    const orders: MockOrder[] = ((ordRes.data as unknown as { data?: OrderResponseDto[] })?.data ?? []).map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customerName: o.note ? `Khách (${o.note})` : 'Khách tại quầy',
      status: o.status as OrderStatus,
      subtotalVnd: o.subtotalVnd,
      promoDiscountVnd: o.promoDiscountVnd,
      pointsDiscountVnd: o.pointsDiscountVnd,
      totalVnd: o.totalVnd,
      lines: o.lines.map((l) => ({
        productName: l.productName,
        size: l.size as 'S' | 'M' | 'L',
        quantity: l.qty ?? 1,
        unitPriceVnd: l.unitPriceVnd,
      })),
      cancelNote: unwrapNullable(o.cancelNote),
      refundStatus: o.refundStatus,
      createdAt: o.createdAt,
    }));

    return (
      <DashboardClient
        users={users}
        categories={categories}
        toppings={toppings}
        products={products}
        promotions={promotions}
        orders={orders}
      />
    );
  } catch (err) {
    handlePageApiError(err);
  }
}