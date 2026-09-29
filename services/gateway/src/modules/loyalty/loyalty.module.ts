import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller.js';
import { LoyaltyGrpcClient } from './loyalty-grpc.client.js';
import { LoyaltyService } from './loyalty.service.js';

@Module({
  controllers: [LoyaltyController],
  providers: [LoyaltyGrpcClient, LoyaltyService],
})
export class LoyaltyModule {}
