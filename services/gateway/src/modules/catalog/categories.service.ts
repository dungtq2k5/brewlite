import { Injectable } from '@nestjs/common';
import { CatalogServiceGrpcClient } from './catalog-service-grpc.client.js';
import { toCategoryResponseDto } from './category.mapper.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly catalog: CatalogServiceGrpcClient) {}

  async listCategories(requestId?: string): Promise<CategoryResponseDto[]> {
    const response = await this.catalog.listCategories({}, requestId);
    return response.categories.map(toCategoryResponseDto);
  }
}
