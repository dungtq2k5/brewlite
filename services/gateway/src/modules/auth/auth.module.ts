import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { IdentityServiceGrpcClient } from './identity-service-grpc.client.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, IdentityServiceGrpcClient],
  exports: [IdentityServiceGrpcClient],
})
export class AuthModule {}
