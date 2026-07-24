import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { RoadGroupModule } from '../../roads/road-group.module';
import { HovController } from './hov.controller';
import { HovService } from './hov.service';

@Module({
  imports: [NcqpModule, RoadGroupModule],
  controllers: [HovController],
  providers: [HovService],
})
export class HovModule {}
