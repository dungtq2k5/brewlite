import type { ProductSize } from '@brewlite/contracts';
import type {
  AdminProduct as AdminProductProto,
  AdminProductListItem as AdminProductListItemProto,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type {
  AdminProductListItemResponseDto,
  AdminProductResponseDto,
} from './dto/admin-product.dto.js';

export function toAdminProductListItemResponseDto(
  proto: AdminProductListItemProto,
): AdminProductListItemResponseDto {
  return {
    id: proto.id,
    categoryId: proto.categoryId,
    categoryName: { en: proto.categoryNameEn, vi: proto.categoryNameVi },
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    basePriceVnd: proto.basePriceVnd,
    imageUrl: proto.imageUrl ?? null,
    isAvailable: proto.isAvailable,
    stockQty: proto.stockQty ?? null,
    version: proto.version,
    sortOrder: proto.sortOrder,
    createdAt: proto.createdAt,
    deletedAt: proto.deletedAt ?? null,
  };
}

export function toAdminProductResponseDto(proto: AdminProductProto): AdminProductResponseDto {
  return {
    id: proto.id,
    categoryId: proto.categoryId,
    categoryName: { en: proto.categoryNameEn, vi: proto.categoryNameVi },
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    description: proto.description ? { en: proto.description.en, vi: proto.description.vi } : null,
    basePriceVnd: proto.basePriceVnd,
    imageUrl: proto.imageUrl ?? null,
    isAvailable: proto.isAvailable,
    stockQty: proto.stockQty ?? null,
    version: proto.version,
    sortOrder: proto.sortOrder,
    sizes: proto.sizes.map((size) => ({
      size: size.size as ProductSize,
      priceDeltaVnd: size.priceDeltaVnd,
    })),
    toppingIds: proto.toppingIds,
    createdAt: proto.createdAt,
    deletedAt: proto.deletedAt ?? null,
    deletedById: proto.deletedById ?? null,
  };
}
