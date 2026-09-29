import { Module } from '@nestjs/common';
import { LoyaltyGrpcController } from './loyalty-grpc.controller.js';
import { LoyaltyService } from './loyalty.service.js';

@Module({
  controllers: [LoyaltyGrpcController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
