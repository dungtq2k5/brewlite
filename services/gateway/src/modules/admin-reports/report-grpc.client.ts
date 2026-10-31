import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseGrpcClient, type Caller } from '@brewlite/nest-common';
import { ORDERING_PROTO_FILES, PROTO_ROOT } from '@brewlite/contracts/proto-paths.js';
import type {
  GetStaffStatsRequest,
  GetStaffStatsResponse,
  SalesReportRequest,
  SalesReportResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/report_service.js';
import type { Env } from '../../config/env.schema.js';

/** The report groups a quarter of orders in SQL; give it more than the 2 s default. */
const SALES_REPORT_DEADLINE_MS = 5_000;

@Injectable()
export class ReportGrpcClient extends BaseGrpcClient {
  constructor(config: ConfigService<Env, true>) {
    super({
      serviceName: 'brewlite.ordering.ReportService',
      protoFiles: ORDERING_PROTO_FILES,
      includeDirs: [PROTO_ROOT],
      url: config.get('ORDERING_GRPC_URL', { infer: true }),
    });
  }

  salesReport(
    caller: Caller,
    request: SalesReportRequest,
    requestId?: string,
  ): Promise<SalesReportResponse> {
    return this.call('salesReport', request, {
      requestId,
      caller,
      deadlineMs: SALES_REPORT_DEADLINE_MS,
    });
  }

  getStaffStats(
    caller: Caller,
    request: GetStaffStatsRequest,
    requestId?: string,
  ): Promise<GetStaffStatsResponse> {
    return this.call('getStaffStats', request, { requestId, caller });
  }
}
