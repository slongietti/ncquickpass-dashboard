import { Module } from '@nestjs/common';
import { NcqpModule } from '../ncqp/ncqp.module';
import { RoadGroupModule } from '../../roads/road-group.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [NcqpModule, RoadGroupModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
