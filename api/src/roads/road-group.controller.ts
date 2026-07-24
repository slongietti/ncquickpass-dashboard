import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../endpoints/auth/session/auth.guard';
import { RoadGroupService } from './road-group.service';

/** The road group shape exposed to the UI (keywords stay server-side). */
export interface RoadGroupView {
  id: string;
  label: string;
  hovEligible: boolean;
}

/** Exposes the configured road groups so the UI can build its toll filters. */
@Controller('road-groups')
@UseGuards(AuthGuard)
export class RoadGroupController {
  constructor(private readonly roads: RoadGroupService) {}

  @Get()
  list(): RoadGroupView[] {
    return this.roads.groups().map((g) => ({
      id: g.id,
      label: g.label,
      hovEligible: g.hovEligible,
    }));
  }
}
