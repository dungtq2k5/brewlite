import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors } from '@brewlite/nest-common';
import { CategoriesService } from './categories.service.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';

/**
 * No `@Auth('PUBLIC')` marker and no `PUBLIC_READ` rate limit yet — the marker system
 * and the throttler need identity's auth guard first, and must mark this route once it exists.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiEnvelope(CategoryResponseDto, { list: true })
  @ApiErrors('UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT')
  list(@Req() req: Request): Promise<CategoryResponseDto[]> {
    return this.categories.listCategories(req.id as string | undefined);
  }
}
