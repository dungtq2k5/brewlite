import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import {
  ApiEnvelope,
  ApiErrors,
  apiError,
  Paged,
  RequirePermission,
  SkipEnvelope,
} from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { AdminProductsService } from './admin-products.service.js';
import {
  AdminProductListItemResponseDto,
  AdminProductResponseDto,
  CreateProductDto,
  ListAdminProductsQueryDto,
  ReplaceSizesDto,
  ReplaceToppingsDto,
  SetProductImageResponseDto,
  UpdateProductDto,
} from './dto/admin-product.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';

@Controller('admin/products')
@RequirePermission('menu.manage')
export class AdminProductsController {
  constructor(private readonly adminProducts: AdminProductsService) {}

  @Get()
  @ApiEnvelope(AdminProductListItemResponseDto, { paged: true })
  @ApiErrors('VALIDATION_FAILED')
  list(
    @Query() query: ListAdminProductsQueryDto,
    @Req() req: Request,
  ): Promise<Paged<AdminProductListItemResponseDto>> {
    return this.adminProducts.list(query, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(AdminProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  get(@Param() params: ProductIdParamDto, @Req() req: Request): Promise<AdminProductResponseDto> {
    return this.adminProducts.get(params.id, req.id as string | undefined);
  }

  @Post()
  @ApiEnvelope(AdminProductResponseDto, { status: 201 })
  @ApiErrors('RESOURCE_REFERENCE_INVALID', 'PRODUCT_NAME_TAKEN')
  create(@Body() dto: CreateProductDto, @Req() req: Request): Promise<AdminProductResponseDto> {
    return this.adminProducts.create(dto, req.id as string | undefined);
  }

  @Patch(':id')
  @ApiEnvelope(AdminProductResponseDto)
  @ApiErrors(
    'RESOURCE_NOT_FOUND',
    'INVALID_STATE',
    'RESOURCE_REFERENCE_INVALID',
    'PRODUCT_NAME_TAKEN',
  )
  update(
    @Param() params: ProductIdParamDto,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ): Promise<AdminProductResponseDto> {
    return this.adminProducts.update(params.id, dto, req.id as string | undefined);
  }

  @Put(':id/sizes')
  @ApiEnvelope(AdminProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'VALIDATION_FAILED')
  replaceSizes(
    @Param() params: ProductIdParamDto,
    @Body() dto: ReplaceSizesDto,
    @Req() req: Request,
  ): Promise<AdminProductResponseDto> {
    return this.adminProducts.replaceSizes(params.id, dto, req.id as string | undefined);
  }

  @Put(':id/toppings')
  @ApiEnvelope(AdminProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'RESOURCE_REFERENCE_INVALID')
  replaceToppings(
    @Param() params: ProductIdParamDto,
    @Body() dto: ReplaceToppingsDto,
    @Req() req: Request,
  ): Promise<AdminProductResponseDto> {
    return this.adminProducts.replaceToppings(params.id, dto, req.id as string | undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  async delete(
    @Param() params: ProductIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.adminProducts.delete(params.id, ctx, req.id as string | undefined);
  }

  @Post(':id/restore')
  @ApiEnvelope(AdminProductResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'PRODUCT_NAME_TAKEN')
  restore(
    @Param() params: ProductIdParamDto,
    @Req() req: Request,
  ): Promise<AdminProductResponseDto> {
    return this.adminProducts.restore(params.id, req.id as string | undefined);
  }

  @Put(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1, fields: 0 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiEnvelope(SetProductImageResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'IMAGE_INVALID', 'VALIDATION_FAILED')
  setImage(
    @Param() params: ProductIdParamDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<{ imageUrl: string | null }> {
    if (!file)
      throw apiError('VALIDATION_FAILED', { issues: [{ path: '/file', code: 'required' }] });
    return this.adminProducts.setImage(params.id, file, req.id as string | undefined);
  }

  @Delete(':id/image')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  async clearImage(@Param() params: ProductIdParamDto, @Req() req: Request): Promise<void> {
    await this.adminProducts.clearImage(params.id, req.id as string | undefined);
  }
}
