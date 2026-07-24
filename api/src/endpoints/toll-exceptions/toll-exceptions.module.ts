import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { TollExceptionsController } from './toll-exceptions.controller';
import { TollExceptionsService } from './toll-exceptions.service';

@Module({
  imports: [NcqpModule],
  controllers: [TollExceptionsController],
  providers: [TollExceptionsService],
})
export class TollExceptionsModule {}
