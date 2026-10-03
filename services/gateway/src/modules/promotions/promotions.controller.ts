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
import {
  ApiEnvelope,
  ApiErrors,
  Paged,
  RequirePermission,
  SkipEnvelope,
} from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { PromotionsService } from './promotions.service.js';
import {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  PromotionResponseDto,
  UpdatePromotionDto,
} from './dto/promotion.dto.js';
import { PromotionIdParamDto } from './dto/promotion-id-param.dto.js';

@Controller('admin/promotions')
@RequirePermission('promotion.manage')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @ApiEnvelope(PromotionResponseDto, { paged: true })
  @ApiErrors('VALIDATION_FAILED')
  list(
    @Query() query: ListPromotionsQueryDto,
    @Req() req: Request,
  ): Promise<Paged<PromotionResponseDto>> {
    return this.promotions.list(query, req.id as string | undefined);
  }

  @Post()
  @ApiEnvelope(PromotionResponseDto, { status: 201 })
  @ApiErrors('PROMO_CODE_TAKEN', 'VALIDATION_FAILED')
  create(@Body() dto: CreatePromotionDto, @Req() req: Request): Promise<PromotionResponseDto> {
    return this.promotions.create(dto, req.id as string | undefined);
  }

  @Get(':id')
  @ApiEnvelope(PromotionResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  get(@Param() params: PromotionIdParamDto, @Req() req: Request): Promise<PromotionResponseDto> {
    return this.promotions.get(params.id, req.id as string | undefined);
  }

  @Patch(':id')
  @ApiEnvelope(PromotionResponseDto)
  @ApiErrors(
    'RESOURCE_NOT_FOUND',
    'INVALID_STATE',
    'PROMO_MAX_USES_BELOW_USED',
    'VALIDATION_FAILED',
  )
  update(
    @Param() params: PromotionIdParamDto,
    @Body() dto: UpdatePromotionDto,
    @Req() req: Request,
  ): Promise<PromotionResponseDto> {
    return this.promotions.update(params.id, dto, req.id as string | undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  async delete(
    @Param() params: PromotionIdParamDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.promotions.delete(ctx, params.id, req.id as string | undefined);
  }

  @Post(':id/restore')
  @ApiEnvelope(PromotionResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE')
  restore(
    @Param() params: PromotionIdParamDto,
    @Req() req: Request,
  ): Promise<PromotionResponseDto> {
    return this.promotions.restore(params.id, req.id as string | undefined);
  }
}
