import { Module } from '@nestjs/common';
import { CatalogServiceGrpcClient } from './catalog-service-grpc.client.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CatalogServiceGrpcClient],
})
export class CatalogModule {}
