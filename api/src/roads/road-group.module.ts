import { Module } from '@nestjs/common';
import { RoadGroupService } from './road-group.service';

/** Road classification (HOV eligibility + grouping), shared across features. */
@Module({
  providers: [RoadGroupService],
  exports: [RoadGroupService],
})
export class RoadGroupModule {}
