import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { ReportGrpcClient } from './report-grpc.client.js';
import type { SalesReportQueryDto, SalesReportResponseDto } from './dto/sales-report.dto.js';

@Injectable()
export class AdminReportsService {
  constructor(private readonly reports: ReportGrpcClient) {}

  async salesReport(
    ctx: UserContext,
    query: SalesReportQueryDto,
    requestId?: string,
  ): Promise<SalesReportResponseDto> {
    const caller: Caller = { kind: 'USER', userId: ctx.userId, role: ctx.role };
    const response = await this.reports.salesReport(
      caller,
      { from: query.from, to: query.to },
      requestId,
    );
    return {
      days: response.days.map((d) => ({
        day: d.day,
        orders: d.orders,
        revenueVnd: Number(d.revenueVnd),
      })),
      topProducts: response.topProducts.map((p) => ({
        productId: p.productId,
        productName: { en: p.productName!.en, vi: p.productName!.vi },
        qty: p.qty,
        revenueVnd: Number(p.revenueVnd),
      })),
    };
  }
}
