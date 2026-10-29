import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AdminUsersGrpcController } from './admin-users-grpc.controller.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AdminUsersGrpcController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
