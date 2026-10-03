import { Module } from '@nestjs/common';
import { AdminUsersGrpcController } from './admin-users-grpc.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  controllers: [AdminUsersGrpcController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
