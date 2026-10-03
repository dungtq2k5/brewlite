import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isZodDto, type ZodDto } from 'nestjs-zod/dto';
import { map, type Observable } from 'rxjs';
import { z, type ZodType } from 'zod';
import { Paged } from './paged.js';

const ZOD_SERIALIZER_DTO_OPTIONS = 'ZOD_SERIALIZER_DTO_OPTIONS';

/**
 * Validates the handler's raw return value against the route's response schema
 * (attached by `@ZodSerializerDto`) in development and test, and strips it to the
 * schema in production so a mapper cannot leak a column (conventions §6.2). Runs
 * BEFORE the envelope wraps the value — registered second in `main.ts` so it runs
 * first on the way out. A `Paged` value is validated on its `items`, not itself —
 * `meta` is trusted (it never holds column data).
 */
@Injectable()
export class ResponseValidationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly isProduction: boolean,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const dto = this.reflector.get<ZodDto | ZodType | [ZodDto | ZodType] | undefined>(
      ZOD_SERIALIZER_DTO_OPTIONS,
      context.getHandler(),
    );
    if (!dto) return next.handle();
    const target = Array.isArray(dto) ? dto[0] : dto;
    const itemSchema = (isZodDto(target) ? target.schema : target) as ZodType;
    const schema = Array.isArray(dto) ? z.array(itemSchema) : itemSchema;

    return next.handle().pipe(
      map((value) => {
        if (value instanceof Paged) {
          return value.withItems(this.validate(schema, value.items) as unknown[]);
        }
        return this.validate(schema, value);
      }),
    );
  }

  private validate(schema: ZodType, value: unknown): unknown {
    if (this.isProduction) {
      const result = schema.safeParse(value);
      return result.success ? result.data : value;
    }
    return schema.parse(value);
  }
}
