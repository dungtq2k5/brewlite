import { Body, Controller, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, RequirePermission } from '@brewlite/nest-common';
import { StaffToppingsService } from './staff-toppings.service.js';
import { StaffToppingResponseDto } from './dto/staff-response.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { ProductIdParamDto } from './dto/product-id-param.dto.js';

@Controller('staff/toppings')
@RequirePermission('stock.update')
export class StaffToppingsController {
  constructor(private readonly staffToppings: StaffToppingsService) {}

  @Patch(':id/availability')
  @ApiEnvelope(StaffToppingResponseDto)
  @ApiErrors('RESOURCE_NOT_FOUND')
  setAvailability(
    @Param() params: ProductIdParamDto,
    @Body() dto: SetAvailabilityDto,
    @Req() req: Request,
  ): Promise<StaffToppingResponseDto> {
    return this.staffToppings.setAvailability(params.id, dto, req.id as string | undefined);
  }
}
