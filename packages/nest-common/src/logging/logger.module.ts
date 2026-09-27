import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'node:http';
import type {} from 'pino-http';
import { getRequestId } from '../grpc/request-context.js';

/**
 * JSON pino logging, `LOG_LEVEL`-driven, a redaction backstop (conventions §9.3, §13.1).
 * `mixin` merges the AsyncLocalStorage-bound `requestId` (set by `runWithRequestId`) into
 * every log line — HTTP's `genReqId` already binds `req.id` for the request/response
 * lines, but a gRPC service has no HTTP request, so `mixin` is what carries the id there
 * (impl doc 01 check 6).
 */
export const BrewliteLoggerModule = LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get<string>('LOG_LEVEL', 'info'),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.passwordHash',
          '*.token',
          '*.refreshToken',
          '*.clientSecret',
        ],
        censor: '[redacted]',
      },
      genReqId: (req: IncomingMessage) => req.id,
      mixin: () => {
        const requestId = getRequestId();
        return requestId ? { requestId } : {};
      },
    },
  }),
});
