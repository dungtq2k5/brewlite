import {
  type ArgumentsHost,
  type ExceptionFilter,
  BadRequestException,
  Catch,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ERRORS, GrpcStatus, type ErrorCode } from '@brewlite/contracts';
import { ApiError } from '../errors/api-error.js';
import {
  isGrpcServiceError,
  readErrorCode,
  readErrorDetails,
} from '../errors/grpc-service-error.js';

interface ZodIssueLike {
  path: (string | number)[];
  code: string;
}

/** RFC 6901: `''` for the root; each segment escapes `~` → `~0` and `/` → `~1`. */
function toJsonPointer(path: (string | number)[]): string {
  if (path.length === 0) return '';
  return `/${path.map((segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

/**
 * The gateway half of `rpcError` (conventions §5.3). Every response
 * carries `requestId`. Production silence (§13.3): every `5xx` and `403` gets a generic
 * message, keeping its `code`; no stack leaves the process.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req.id !== undefined ? String(req.id) : 'unknown';

    const { status, code, details } = this.classify(exception, requestId);

    let message: string = code;
    if (this.isProduction && (status >= 500 || status === 403)) {
      message = 'An error occurred';
    }

    res
      .status(status)
      .json({ error: { code, message, ...(details !== undefined ? { details } : {}), requestId } });
  }

  private classify(
    exception: unknown,
    requestId: string,
  ): { status: number; code: ErrorCode; details?: unknown } {
    if (exception instanceof ApiError) {
      const definition = ERRORS[exception.code];
      if (this.isProduction && exception.code === 'PERMISSION_DENIED') {
        return { status: definition.http, code: exception.code };
      }
      return { status: definition.http, code: exception.code, details: exception.details };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as { issues: ZodIssueLike[] };
      const issues = zodError.issues.map((issue) => ({
        path: toJsonPointer(issue.path),
        code: issue.code,
      }));
      return { status: 400, code: 'VALIDATION_FAILED', details: { issues } };
    }

    if (this.isBodyParserFailure(exception)) {
      return { status: 400, code: 'MALFORMED_REQUEST' };
    }

    if (this.isMulterFileTooLargeError(exception)) {
      return { status: 422, code: 'IMAGE_INVALID', details: { reason: 'SIZE' } };
    }

    if (exception instanceof NotFoundException) {
      return { status: 404, code: 'ROUTE_NOT_FOUND' };
    }

    if (isGrpcServiceError(exception)) {
      const blCode = readErrorCode(exception);
      if (blCode && blCode in ERRORS) {
        const errorCode = blCode as ErrorCode;
        const definition = ERRORS[errorCode];
        const rawDetails = readErrorDetails(exception);
        if (!definition.details) return { status: definition.http, code: errorCode };
        const parsed = definition.details.safeParse(rawDetails);
        if (parsed.success) {
          // The required permission is not named in production (api-endpoints-plan §7,
          // conventions §13.3). ACCOUNT_LOCKED, the other 403 with details, keeps its
          // details — the user needs to know when the lock lifts.
          if (this.isProduction && errorCode === 'PERMISSION_DENIED') {
            return { status: definition.http, code: errorCode };
          }
          return { status: definition.http, code: errorCode, details: parsed.data };
        }
        this.logger.error({ requestId, blCode }, 'gRPC error details failed their schema');
        return { status: 500, code: 'INTERNAL' };
      }
      if (blCode) {
        this.logger.error({ requestId, blCode }, 'Unknown bl-error-code crossed the boundary');
        return { status: 500, code: 'INTERNAL' };
      }
      if (exception.code === GrpcStatus.UNAVAILABLE) {
        return { status: 503, code: 'UPSTREAM_UNAVAILABLE' };
      }
      if (exception.code === GrpcStatus.DEADLINE_EXCEEDED) {
        return { status: 504, code: 'UPSTREAM_TIMEOUT' };
      }
    }

    this.logger.error({ requestId, err: exception }, 'Unhandled exception');
    return { status: 500, code: 'INTERNAL' };
  }

  /**
   * The one place multer errors are recognised. `FileInterceptor` already
   * translates multer's `LIMIT_FILE_SIZE` into a `PayloadTooLargeException` before it
   * ever reaches a filter (`multer.utils.js`'s `transformException`) — there is no raw
   * `MulterError` to catch here.
   */
  private isMulterFileTooLargeError(exception: unknown): boolean {
    return exception instanceof PayloadTooLargeException;
  }

  /**
   * body-parser's own error carries `{ type: 'entity.parse.failed' }`; Express 5's
   * router instead routes a body-parser `SyntaxError` through Nest's own exception
   * mapping as a `BadRequestException` whose message names the JSON parse failure —
   * verified against the installed `@nestjs/core` / Express 5, not assumed.
   */
  private isBodyParserFailure(exception: unknown): boolean {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { type?: string }).type === 'entity.parse.failed'
    ) {
      return true;
    }
    if (exception instanceof BadRequestException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string }).message ?? '');
      return /JSON/i.test(message);
    }
    return false;
  }
}
