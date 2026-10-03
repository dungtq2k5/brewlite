import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, Auth } from '@brewlite/nest-common';
import { CategoriesService } from './categories.service.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';

@Controller('categories')
@Auth('PUBLIC')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiEnvelope(CategoryResponseDto, { list: true })
  @ApiErrors('UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT')
  list(@Req() req: Request): Promise<CategoryResponseDto[]> {
    return this.categories.listCategories(req.id as string | undefined);
  }
}
