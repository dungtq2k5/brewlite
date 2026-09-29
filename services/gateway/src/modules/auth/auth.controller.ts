import { Body, Controller, Header, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiEnvelope, ApiErrors, Auth, RateLimit, SkipEnvelope } from '@brewlite/nest-common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshResponseDto, SessionResponseDto } from './dto/session-response.dto.js';

@Controller('auth')
@Auth('PUBLIC')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @RateLimit('AUTH')
  @ApiEnvelope(SessionResponseDto, { status: 201 })
  @ApiErrors('EMAIL_TAKEN')
  @Header('Cache-Control', 'private, no-store')
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<SessionResponseDto> {
    return this.auth.register(dto, req.id as string | undefined);
  }

  @Post('login')
  @RateLimit('AUTH')
  @HttpCode(200)
  @ApiEnvelope(SessionResponseDto)
  @ApiErrors('INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_DEACTIVATED')
  @Header('Cache-Control', 'private, no-store')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<SessionResponseDto> {
    return this.auth.login(dto, req.id as string | undefined);
  }

  @Post('refresh')
  @RateLimit('SESSION')
  @ApiEnvelope(RefreshResponseDto)
  @ApiErrors('UNAUTHENTICATED')
  @Header('Cache-Control', 'private, no-store')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<RefreshResponseDto> {
    return this.auth.refresh(dto.refreshToken, req.id as string | undefined);
  }

  @Post('logout')
  @RateLimit('SESSION')
  @HttpCode(204)
  @SkipEnvelope()
  @Header('Cache-Control', 'private, no-store')
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<void> {
    await this.auth.logout(dto.refreshToken, req.id as string | undefined);
  }
}
