import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [NcqpModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
