import { RoadGroupService } from '../../src/roads/road-group.service';
import { DbClient } from '../../src/database/db-client';

const SEED = [
  { id: 'express-a', label: 'Express A', keywords: ['EXPWY'], hovEligible: true },
];

async function makeService(rows: unknown[] = SEED): Promise<RoadGroupService> {
  const db = { roadGroup: { findMany: jest.fn().mockResolvedValue(rows) } };
  const service = new RoadGroupService(db as unknown as DbClient);
  await service.onModuleInit();
  return service;
}

describe('RoadGroupService', () => {
  let service: RoadGroupService;

  beforeEach(async () => {
    service = await makeService();
  });

  it('classify_matchingLocation_returnsGroup', () => {
    const group = service.classify('EXPWY Exit 16');
    expect(group?.id).toBe('express-a');
    expect(group?.hovEligible).toBe(true);
  });

  it('classify_caseInsensitive_matches', () => {
    expect(service.classify('Northbound EXPWY ramp')?.id).toBe('express-a');
    expect(service.classify('northbound expwy ramp')?.id).toBe('express-a');
  });

  it('classify_nonHovRoad_returnsNull', () => {
    expect(service.classify('Ghent South / AS')).toBeNull();
  });

  it('classify_emptyOrNullish_returnsNull', () => {
    expect(service.classify('')).toBeNull();
    expect(service.classify(null)).toBeNull();
    expect(service.classify(undefined)).toBeNull();
  });

  it('isHovEligible_eligibleRoadTrue_otherFalse', () => {
    expect(service.isHovEligible('EXPWY Exit 16')).toBe(true);
    expect(service.isHovEligible('Ghent South / AS')).toBe(false);
  });

  it('groups_returnsCachedGroups', () => {
    expect(service.groups().map((g) => g.id)).toContain('express-a');
  });

  it('defaultHovLocation_returnsFirstHovEligibleLabel', () => {
    expect(service.defaultHovLocation()).toBe('Express A');
  });

  it('defaultHovLocation_noHovGroups_returnsEmpty', async () => {
    const svc = await makeService([
      { id: 'plain', label: 'Plain', keywords: ['X'], hovEligible: false },
    ]);
    expect(svc.defaultHovLocation()).toBe('');
  });

  it('classify_beforeRefresh_isEmpty', () => {
    const db = { roadGroup: { findMany: jest.fn() } };
    const fresh = new RoadGroupService(db as unknown as DbClient);
    expect(fresh.classify('EXPWY Exit 16')).toBeNull();
  });
});
