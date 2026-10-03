import type {
  LoginResponse,
  RegisterResponse,
  SignInWithFirebaseResponse,
} from '@brewlite/contracts/generated/brewlite/identity/auth_service.js';
import { toMeResponseDto } from '../users/user.mapper.js';
import type { SessionResponseDto } from './dto/session-response.dto.js';

export function toSessionResponseDto(
  proto: RegisterResponse | LoginResponse | SignInWithFirebaseResponse,
): SessionResponseDto {
  return {
    user: toMeResponseDto(proto.user!),
    accessToken: proto.accessToken,
    accessTokenExpiresAt: proto.accessTokenExpiresAt,
    refreshToken: proto.refreshToken,
    refreshTokenExpiresAt: proto.refreshTokenExpiresAt,
  };
}
