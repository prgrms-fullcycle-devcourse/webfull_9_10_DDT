import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';
import { UsersService } from './user.service'; 
import { PrismaService } from '../../prisma/prisma.service'; 

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService], 
})
export class UserModule {}