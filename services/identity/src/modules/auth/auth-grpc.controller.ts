import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcRequestContextInterceptor } from '@brewlite/nest-common';
import {
  AuthServiceControllerMethods,
  type AuthServiceController,
  type LoginRequest,
  type LoginResponse,
  type LogoutRequest,
  type LogoutResponse,
  type RefreshRequest,
  type RefreshResponse,
  type RegisterRequest,
  type RegisterResponse,
  type SignInWithFirebaseRequest,
  type SignInWithFirebaseResponse,
} from '@brewlite/contracts/generated/brewlite/identity/auth_service.js';
import { AuthService } from './auth.service.js';

@Controller()
@AuthServiceControllerMethods()
@UseInterceptors(GrpcRequestContextInterceptor)
export class AuthGrpcController implements AuthServiceController {
  constructor(private readonly auth: AuthService) {}

  register(request: RegisterRequest): Promise<RegisterResponse> {
    return this.auth.register(request);
  }

  login(request: LoginRequest): Promise<LoginResponse> {
    return this.auth.login(request);
  }

  signInWithFirebase(request: SignInWithFirebaseRequest): Promise<SignInWithFirebaseResponse> {
    return this.auth.signInWithFirebase(request);
  }

  refresh(request: RefreshRequest): Promise<RefreshResponse> {
    return this.auth.refresh(request);
  }

  logout(request: LogoutRequest): Promise<LogoutResponse> {
    return this.auth.logout(request);
  }
}
