import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module.js';
import { FirebaseStorageProvider } from '../../providers/storage/firebase.storage-provider.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import { AdminMenuGrpcController } from './admin-menu-grpc.controller.js';
import { AdminProductsService } from './admin-products.service.js';
import { AdminToppingsService } from './admin-toppings.service.js';

@Module({
  imports: [MenuModule],
  controllers: [AdminMenuGrpcController],
  providers: [
    AdminCategoriesService,
    AdminProductsService,
    AdminToppingsService,
    FirebaseStorageProvider,
  ],
})
export class AdminMenuModule {}
