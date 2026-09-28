import { Injectable } from '@nestjs/common';
import { CatalogServiceGrpcClient } from './catalog-service-grpc.client.js';
import { toProductDetailResponseDto, toProductSummaryResponseDto } from './product.mapper.js';
import type {
  ProductDetailResponseDto,
  ProductSummaryResponseDto,
} from './dto/product-response.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly catalog: CatalogServiceGrpcClient) {}

  async listProducts(
    categoryId: string | undefined,
    requestId?: string,
  ): Promise<ProductSummaryResponseDto[]> {
    const response = await this.catalog.listProducts({ categoryId }, requestId);
    return response.products.map(toProductSummaryResponseDto);
  }

  async getProduct(id: string, requestId?: string): Promise<ProductDetailResponseDto> {
    const response = await this.catalog.getProduct({ id }, requestId);
    return toProductDetailResponseDto(response.product!);
  }
}
