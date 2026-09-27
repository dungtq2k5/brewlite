import { Module } from '@nestjs/common';
import { MenuGrpcController } from './menu-grpc.controller.js';
import { MenuService } from './menu.service.js';

@Module({
  controllers: [MenuGrpcController],
  providers: [MenuService],
})
export class MenuModule {}
