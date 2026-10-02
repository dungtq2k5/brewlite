import { Module } from '@nestjs/common';
import { UsersGrpcController } from './users-grpc.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersGrpcController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
