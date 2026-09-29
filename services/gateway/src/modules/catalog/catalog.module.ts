import { Module } from '@nestjs/common';
import { AdminCategoriesController } from './admin-categories.controller.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminProductsController } from './admin-products.controller.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminToppingsController } from './admin-toppings.controller.js';
import { AdminToppingsService } from './admin-toppings.service.js';
import { CatalogAdminGrpcClient } from './catalog-admin-grpc.client.js';
import { CatalogServiceGrpcClient } from './catalog-service-grpc.client.js';
import { CatalogStockGrpcClient } from './catalog-stock-grpc.client.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { StaffProductsController } from './staff-products.controller.js';
import { StaffProductsService } from './staff-products.service.js';
import { StaffToppingsController } from './staff-toppings.controller.js';
import { StaffToppingsService } from './staff-toppings.service.js';

@Module({
  controllers: [
    CategoriesController,
    ProductsController,
    StaffProductsController,
    StaffToppingsController,
    AdminCategoriesController,
    AdminProductsController,
    AdminToppingsController,
  ],
  providers: [
    CategoriesService,
    ProductsService,
    StaffProductsService,
    StaffToppingsService,
    AdminCategoriesService,
    AdminProductsService,
    AdminToppingsService,
    CatalogServiceGrpcClient,
    CatalogStockGrpcClient,
    CatalogAdminGrpcClient,
  ],
})
export class CatalogModule {}
