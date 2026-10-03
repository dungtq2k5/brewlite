import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { Paged } from './paged.js';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator.js';

/**
 * Wraps a handler's raw return value as `{ data }` — or, for a `Paged` value,
 * `{ data: items, meta }`. Registered FIRST in `main.ts` so it runs LAST on the way out
 * — after `ResponseValidationInterceptor` has already checked the raw value.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();
    return next
      .handle()
      .pipe(
        map((data) => (data instanceof Paged ? { data: data.items, meta: data.meta } : { data })),
      );
  }
}
