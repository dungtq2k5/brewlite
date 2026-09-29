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
import { AdminToppingsService } from './admin-toppings.service.js';
import {
  AdminToppingResponseDto,
  CreateToppingDto,
  ListToppingsQueryDto,
  UpdateToppingDto,
} from './dto/admin-topping.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';

@Controller('admin/toppings')
@RequirePermission('menu.manage')
export class AdminToppingsController {
  constructor(private readonly adminToppings: AdminToppingsService) {}

  @Get()
  @ApiEnvelope(AdminToppingResponseDto, { list: true })
  list(
    @Query() query: ListToppingsQueryDto,
    @Req() req: Request,
  ): Promise<AdminToppingResponseDto[]> {
    return this.adminToppings.list(query.deleted, req.id as string | undefined);
  }

  @Post()
  @ApiEnvelope(AdminToppingResponseDto, { status: 201 })
  @ApiErrors('TOPPING_NAME_TAKEN')
  create(@Body() dto: CreateToppingDto, @Req() req: Request): Promise<AdminToppingResponseDto> {
    return this.adminToppings.create(dto, req.id as string | undefined);
  }

  @Patch(':id')
  @ApiEnvelope(AdminToppingResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'TOPPING_NAME_TAKEN')
  update(
    @Param() params: ProductIdParamDto,
    @Body() dto: UpdateToppingDto,
    @Req() req: Request,
  ): Promise<AdminToppingResponseDto> {
    return this.adminToppings.update(params.id, dto, req.id as string | undefined);
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
    await this.adminToppings.delete(params.id, ctx, req.id as string | undefined);
  }

  @Post(':id/restore')
  @ApiEnvelope(AdminToppingResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND', 'INVALID_STATE', 'TOPPING_NAME_TAKEN')
  restore(
    @Param() params: ProductIdParamDto,
    @Req() req: Request,
  ): Promise<AdminToppingResponseDto> {
    return this.adminToppings.restore(params.id, req.id as string | undefined);
  }
}
