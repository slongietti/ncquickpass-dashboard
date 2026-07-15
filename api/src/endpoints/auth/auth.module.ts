import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [NcqpModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
