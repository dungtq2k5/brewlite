import type { ProductSize } from '@brewlite/contracts';
import type {
  ProductDetail as ProductDetailProto,
  ProductSummary as ProductSummaryProto,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type {
  ProductDetailResponseDto,
  ProductSummaryResponseDto,
} from './dto/product-response.dto.js';

export function toProductSummaryResponseDto(proto: ProductSummaryProto): ProductSummaryResponseDto {
  return {
    id: proto.id,
    categoryId: proto.categoryId,
    name: { en: proto.name?.en ?? '', vi: proto.name?.vi ?? '' },
    imageUrl: proto.imageUrl ?? null,
    fromPriceVnd: proto.fromPriceVnd,
    isSoldOut: proto.isSoldOut,
  };
}

/** Flattens `ProductDetail.summary` into the top level (conventions §5.1). */
export function toProductDetailResponseDto(proto: ProductDetailProto): ProductDetailResponseDto {
  return {
    ...toProductSummaryResponseDto(proto.summary!),
    description: proto.description ? { en: proto.description.en, vi: proto.description.vi } : null,
    basePriceVnd: proto.basePriceVnd,
    sizes: proto.sizes.map((size) => ({
      size: size.size as ProductSize,
      priceDeltaVnd: size.priceDeltaVnd,
    })),
    toppings: proto.toppings.map((topping) => ({
      id: topping.id,
      name: { en: topping.name?.en ?? '', vi: topping.name?.vi ?? '' },
      priceVnd: topping.priceVnd,
    })),
    maxToppings: proto.maxToppings,
  };
}
