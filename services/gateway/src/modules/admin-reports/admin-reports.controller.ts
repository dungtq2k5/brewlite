import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { AdminReportsService } from './admin-reports.service.js';
import { SalesReportQueryDto, SalesReportResponseDto } from './dto/sales-report.dto.js';

@Controller('admin/reports')
@RequirePermission('report.read')
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @Get('sales')
  @ApiEnvelope(SalesReportResponseDto)
  @ApiErrors('VALIDATION_FAILED')
  sales(
    @Query() query: SalesReportQueryDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<SalesReportResponseDto> {
    return this.reports.salesReport(ctx, query, req.id as string | undefined);
  }
}
