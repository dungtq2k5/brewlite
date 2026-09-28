import { Module } from '@nestjs/common';
import { CatalogServiceGrpcClient } from './catalog-service-grpc.client.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [CategoriesController, ProductsController],
  providers: [CategoriesService, ProductsService, CatalogServiceGrpcClient],
})
export class CatalogModule {}
