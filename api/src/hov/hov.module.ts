import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { HovController } from './hov.controller';
import { HovService } from './hov.service';

@Module({
  imports: [NcqpModule],
  controllers: [HovController],
  providers: [HovService],
})
export class HovModule {}
