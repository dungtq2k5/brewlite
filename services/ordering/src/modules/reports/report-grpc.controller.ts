import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  ReportServiceControllerMethods,
  type ReportServiceController,
  type SalesReportRequest,
  type SalesReportResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/report_service.js';
import { ReportsService } from './reports.service.js';

@Controller()
@ReportServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class ReportGrpcController implements ReportServiceController {
  constructor(private readonly reports: ReportsService) {}

  salesReport(request: SalesReportRequest): Promise<SalesReportResponse> {
    return this.reports.salesReport(request);
  }
}
