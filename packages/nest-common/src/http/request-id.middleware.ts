import type { NextFunction, Request, Response } from 'express';
import { newId } from '@brewlite/contracts';
import { runWithRequestId } from '../grpc/request-context.js';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Takes `X-Request-Id` from the request when it matches the shared bound — the same one
 * `outbox_events.request_id VARCHAR(64)` uses (rdm-spec §2.7) — otherwise generates a
 * UUIDv7. Sets it on the response and hands it to `nestjs-pino` (`genReqId`) and
 * `BaseGrpcClient`. An invalid header is replaced, not refused. The rest of the request
 * runs inside `runWithRequestId` so every log line — not only pino-http's own
 * request/response pair — carries it via the logger's `mixin` (impl doc 01 check 6).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id');
  const requestId = header && VALID_REQUEST_ID.test(header) ? header : newId();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  runWithRequestId(requestId, next);
}
