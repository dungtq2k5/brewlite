import { Module } from '@nestjs/common';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminReportsService } from './admin-reports.service.js';
import { ReportGrpcClient } from './report-grpc.client.js';

@Module({
  controllers: [AdminReportsController],
  providers: [AdminReportsService, ReportGrpcClient],
})
export class AdminReportsModule {}
