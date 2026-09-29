import { Injectable } from '@nestjs/common';
import { IdentityServiceGrpcClient } from './identity-service-grpc.client.js';
import { toSessionResponseDto } from './session.mapper.js';
import type { FirebaseSignInDto } from './dto/firebase-sign-in.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshResponseDto, SessionResponseDto } from './dto/session-response.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly identity: IdentityServiceGrpcClient) {}

  async register(dto: RegisterDto, requestId?: string): Promise<SessionResponseDto> {
    const response = await this.identity.register(dto, requestId);
    return toSessionResponseDto(response);
  }

  async login(dto: LoginDto, requestId?: string): Promise<SessionResponseDto> {
    const response = await this.identity.login(dto, requestId);
    return toSessionResponseDto(response);
  }

  async signInWithFirebase(
    dto: FirebaseSignInDto,
    requestId?: string,
  ): Promise<{ session: SessionResponseDto; created: boolean }> {
    const response = await this.identity.signInWithFirebase({ idToken: dto.idToken }, requestId);
    return { session: toSessionResponseDto(response), created: response.created };
  }

  async refresh(refreshToken: string, requestId?: string): Promise<RefreshResponseDto> {
    const response = await this.identity.refresh({ refreshToken }, requestId);
    return {
      accessToken: response.accessToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
    };
  }

  async logout(refreshToken: string, requestId?: string): Promise<void> {
    await this.identity.logout({ refreshToken }, requestId);
  }
}
