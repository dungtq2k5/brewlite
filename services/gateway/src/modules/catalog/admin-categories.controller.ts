import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission, SkipEnvelope } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { AdminCategoriesService } from './admin-categories.service.js';
import {
  AdminCategoryResponseDto,
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/admin-category.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';

@Controller('admin/categories')
@RequirePermission('menu.manage')
export class AdminCategoriesController {
  constructor(private readonly adminCategories: AdminCategoriesService) {}

  @Get()
  @ApiEnvelope(AdminCategoryResponseDto, { list: true })
  list(
    @Query() query: ListCategoriesQueryDto,
    @Req() req: Request,
  ): Promise<AdminCategoryResponseDto[]> {
    return this.adminCategories.list(query.deleted, req.id as string | undefined);
  }

  @Post()
  @ApiEnvelope(AdminCategoryResponseDto, { status: 201 })
  @ApiErrors('CATEGORY_NAME_TAKEN')
  create(@Body() dto: CreateCategoryDto, @Req() req: Request): Promise<AdminCategoryResponseDto> {
    return this.adminCategories.create(dto, req.id as string | undefined);
  }

  @Patch(':id')
  @ApiEnvelope(AdminCategoryResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'CATEGORY_NAME_TAKEN')
  update(
    @Param() params: ProductIdParamDto,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ): Promise<AdminCategoryResponseDto> {
    return this.adminCategories.update(params.id, dto, req.id as string | undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'CATEGORY_IN_USE')
  async delete(
    @Param() params: ProductIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.adminCategories.delete(params.id, ctx, req.id as string | undefined);
  }

  @Post(':id/restore')
  @ApiEnvelope(AdminCategoryResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'CATEGORY_NAME_TAKEN')
  restore(
    @Param() params: ProductIdParamDto,
    @Req() req: Request,
  ): Promise<AdminCategoryResponseDto> {
    return this.adminCategories.restore(params.id, req.id as string | undefined);
  }
}
