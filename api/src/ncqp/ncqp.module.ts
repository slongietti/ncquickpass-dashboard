import { Module } from '@nestjs/common';
import { NcqpService } from './ncqp.service';

@Module({
  providers: [NcqpService],
  exports: [NcqpService],
})
export class NcqpModule {}
