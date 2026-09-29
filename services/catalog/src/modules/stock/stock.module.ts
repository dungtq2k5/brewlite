import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module.js';
import { StockGrpcController } from './stock-grpc.controller.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [MenuModule],
  controllers: [StockGrpcController],
  providers: [StockService],
})
export class StockModule {}
