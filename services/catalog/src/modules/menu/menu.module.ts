import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { ImageUrlBuilder } from './image-url-builder.service.js';
import { MenuGrpcController } from './menu-grpc.controller.js';
import { MenuCache } from './menu-cache.service.js';
import { MenuService } from './menu.service.js';

@Module({
  imports: [RedisModule],
  controllers: [MenuGrpcController],
  providers: [MenuService, MenuCache, ImageUrlBuilder],
  exports: [MenuCache, ImageUrlBuilder],
})
export class MenuModule {}
