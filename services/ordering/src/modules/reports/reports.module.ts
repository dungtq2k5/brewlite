import { Module } from '@nestjs/common';
import { ReportGrpcController } from './report-grpc.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportGrpcController],
  providers: [ReportsService],
})
export class ReportsModule {}
