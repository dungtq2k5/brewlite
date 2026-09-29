import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthGrpcController } from './auth-grpc.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [JwtModule.register({}), UsersModule],
  controllers: [AuthGrpcController],
  providers: [AuthService, TokenService],
})
export class AuthModule {}
