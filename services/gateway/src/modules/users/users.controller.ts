import { Body, Controller, Get, Header, HttpCode, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, Auth, RateLimit, SkipEnvelope } from '@brewlite/nest-common';
import { Ctx, type UserContext } from '../../auth/request-context.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { UsersService } from './users.service.js';

/** `/users/me` is declared before any future `/users/:id` (conventions §2.2). */
@Controller('users/me')
@Auth('USER')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiEnvelope(MeResponseDto)
  @ApiErrors('UNAUTHENTICATED')
  @Header('Cache-Control', 'private, no-store')
  get(@Ctx() ctx: UserContext, @Req() req: Request): Promise<MeResponseDto> {
    return this.users.getMe(ctx, req.id as string | undefined);
  }

  @Patch()
  @ApiEnvelope(MeResponseDto)
  @ApiErrors('UNAUTHENTICATED')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Body() dto: UpdateMeDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<MeResponseDto> {
    return this.users.updateMe(ctx, dto, req.id as string | undefined);
  }

  /**
   * api §1.2. `AUTH` is keyed by address and by the body's `email`; this body has none, so the
   * address alone limits it — the caller is already signed in, which is the stronger bound.
   */
  @Patch('password')
  @RateLimit('AUTH')
  @HttpCode(204)
  @SkipEnvelope()
  @ApiErrors('UNAUTHENTICATED', 'CURRENT_PASSWORD_INCORRECT', 'VALIDATION_FAILED')
  @Header('Cache-Control', 'private, no-store')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Ctx() ctx: UserContext,
    @Req() req: Request,
  ): Promise<void> {
    await this.users.changePassword(ctx, dto, req.id as string | undefined);
  }
}
