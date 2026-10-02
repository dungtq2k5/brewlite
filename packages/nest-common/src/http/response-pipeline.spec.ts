import { Controller, Get, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Paged } from './paged.js';
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

  @Get('paged')
  @ZodSerializerDto([WidgetResponseDto])
  getPaged() {
    return Paged.page(
      [
        { id: 'w1', extra: 'stripped-in-prod-only' },
        { id: 'w2', extra: 'stripped-in-prod-only' },
      ],
      { page: 1, pageSize: 20, total: 2 },
    );
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
 * envelope wraps it — the guard against reordering.
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

  it('a Paged value is enveloped as { data: items, meta }, items validated', async () => {
    const reflector = new Reflector();
    const validation = new ResponseValidationInterceptor(reflector, false);
    const envelope = new ResponseEnvelopeInterceptor(reflector);
    const instance = new FakeController();
    const ctx = {
      getHandler: () => instance.getPaged,
      getClass: () => FakeController,
    } as unknown as ExecutionContext;

    const rawHandler: CallHandler = { handle: () => of(instance.getPaged()) };
    const afterValidation$ = validation.intercept(ctx, rawHandler);
    const afterEnvelope$ = envelope.intercept(ctx, { handle: () => afterValidation$ });

    const result = await new Promise((resolve) => afterEnvelope$.subscribe(resolve));
    expect(result).toEqual({
      data: [{ id: 'w1' }, { id: 'w2' }],
      meta: { page: 1, pageSize: 20, total: 2 },
    });
  });

  it('an invalid item inside a Paged value fails validation in development', async () => {
    const reflector = new Reflector();
    const validation = new ResponseValidationInterceptor(reflector, false);
    const instance = new FakeController();
    const ctx = {
      getHandler: () => instance.getPaged,
      getClass: () => FakeController,
    } as unknown as ExecutionContext;

    const rawHandler: CallHandler = {
      handle: () =>
        of(Paged.page([{ notAnId: true }] as never, { page: 1, pageSize: 20, total: 1 })),
    };
    const error = await new Promise((resolve) =>
      validation.intercept(ctx, rawHandler).subscribe({ error: resolve }),
    );
    expect(error).toBeInstanceOf(Error);
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
