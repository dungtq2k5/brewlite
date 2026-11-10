import { Module } from '@nestjs/common';
import { ReportGrpcClient } from '../admin-reports/report-grpc.client.js';
import { LoyaltyGrpcClient } from '../loyalty/loyalty-grpc.client.js';
import { AdminUserActivityController } from './admin-user-activity.controller.js';
import { AdminUserActivityService } from './admin-user-activity.service.js';

@Module({
  controllers: [AdminUserActivityController],
  providers: [AdminUserActivityService, LoyaltyGrpcClient, ReportGrpcClient],
})
export class AdminUserActivityModule {}
