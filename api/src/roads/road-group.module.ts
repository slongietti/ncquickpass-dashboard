import { Module } from '@nestjs/common';
import { RoadGroupController } from './road-group.controller';
import { RoadGroupService } from './road-group.service';

/** Road classification (HOV eligibility + grouping), shared across features. */
@Module({
  controllers: [RoadGroupController],
  providers: [RoadGroupService],
  exports: [RoadGroupService],
})
export class RoadGroupModule {}
