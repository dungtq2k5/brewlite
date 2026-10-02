import { Injectable } from '@nestjs/common';
import type { Caller } from '@brewlite/nest-common';
import type { UserContext } from '../../auth/request-context.js';
import { IdentityServiceGrpcClient } from '../auth/identity-service-grpc.client.js';
import { toMeResponseDto } from './user.mapper.js';
import type { MeResponseDto } from './dto/me-response.dto.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';

function toCaller(ctx: UserContext): Caller {
  return { kind: 'USER', userId: ctx.userId, role: ctx.role };
}

@Injectable()
export class UsersService {
  constructor(private readonly identity: IdentityServiceGrpcClient) {}

  async getMe(ctx: UserContext, requestId?: string): Promise<MeResponseDto> {
    const response = await this.identity.getMe(toCaller(ctx), requestId);
    return toMeResponseDto(response.me!);
  }

  async updateMe(ctx: UserContext, dto: UpdateMeDto, requestId?: string): Promise<MeResponseDto> {
    const response = await this.identity.updateMe(toCaller(ctx), dto, requestId);
    return toMeResponseDto(response.me!);
  }
}
