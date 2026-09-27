import { Controller, Get, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor.js';
import { ResponseValidationInterceptor } from './response-validation.interceptor.js';

class WidgetResponseDto extends createZodDto(z.object({ id: z.string() })) {}

@Controller()
class FakeController {
  @Get()
  @ZodSerializerDto(WidgetResponseDto)
  get() {
    return { id: 'w1', extra: 'stripped-in-prod-only' };
  }
}

function fakeContext(): ExecutionContext {
  const instance = new FakeController();
  return {
    getHandler: () => instance.get,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;
}

/**
 * Registered FIRST in `main.ts` = runs LAST on the way out. This chains the two
 * interceptors exactly that way and asserts the raw value is validated BEFORE the
 * envelope wraps it — the guard against reordering (impl doc 01 §9.1).
 */
describe('response pipeline order (validation before envelope)', () => {
  it('wraps the already-validated value as { data }', async () => {
    const reflector = new Reflector();
    const validation = new ResponseValidationInterceptor(reflector, false);
    const envelope = new ResponseEnvelopeInterceptor(reflector);
    const ctx = fakeContext();

    const rawHandler: CallHandler = {
      handle: () => of({ id: 'w1', extra: 'stripped-in-prod-only' }),
    };
    const afterValidation$ = validation.intercept(ctx, rawHandler);
    const afterEnvelope$ = envelope.intercept(ctx, { handle: () => afterValidation$ });

    const result = await new Promise((resolve) => afterEnvelope$.subscribe(resolve));
    expect(result).toEqual({ data: { id: 'w1' } });
  });

  it('a route with no @ZodSerializerDto passes through validation untouched', async () => {
    const reflector = new Reflector();
    const validation = new ResponseValidationInterceptor(reflector, false);
    const ctx = {
      getHandler: () => function bare() {},
      getClass: () => class Bare {},
    } as unknown as ExecutionContext;

    const rawHandler: CallHandler = { handle: () => of({ anything: true }) };
    const result = await new Promise((resolve) =>
      validation.intercept(ctx, rawHandler).subscribe(resolve),
    );
    expect(result).toEqual({ anything: true });
  });
});
