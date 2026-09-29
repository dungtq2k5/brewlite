import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Metadata } from '@grpc/grpc-js';
import { Observable } from 'rxjs';
import { requestIdFromMetadata } from './request-id.js';
import { runWithRequestId } from './request-context.js';

/**
 * Binds `x-request-id` from the call's metadata for the lifetime of the handler, so a
 * gRPC controller method no longer wraps itself in `runWithRequestId`.
 * Subscribing inside `run` is the point: `next.handle()` is lazy, so running only its
 * creation inside `run` would lose the context before the handler executes.
 */
@Injectable()
export class GrpcRequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const requestId = requestIdFromMetadata(context.switchToRpc().getContext<Metadata>());
    return new Observable((subscriber) =>
      runWithRequestId(requestId, () => next.handle().subscribe(subscriber)),
    );
  }
}
