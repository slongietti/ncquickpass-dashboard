import { RoadGroupService } from '../../src/roads/road-group.service';
import { DbClient } from '../../src/database/db-client';

const SEED = [
  { id: 'i77-express', label: 'I-77', keywords: ['77 EL'], hovEligible: true },
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

  it('classify_i77ExpressLocation_returnsI77Group', () => {
    const group = service.classify('I-77 EL Exit 16');
    expect(group?.id).toBe('i77-express');
    expect(group?.hovEligible).toBe(true);
  });

  it('classify_caseInsensitive_matches', () => {
    expect(service.classify('Northbound 77 EL ramp')?.id).toBe('i77-express');
    expect(service.classify('northbound 77 el ramp')?.id).toBe('i77-express');
  });

  it('classify_nonHovRoad_returnsNull', () => {
    expect(service.classify('Ghent South / AS')).toBeNull();
  });

  it('classify_emptyOrNullish_returnsNull', () => {
    expect(service.classify('')).toBeNull();
    expect(service.classify(null)).toBeNull();
    expect(service.classify(undefined)).toBeNull();
  });

  it('isHovEligible_i77True_otherFalse', () => {
    expect(service.isHovEligible('I-77 EL Exit 16')).toBe(true);
    expect(service.isHovEligible('Ghent South / AS')).toBe(false);
  });

  it('groups_returnsCachedGroups', () => {
    expect(service.groups().map((g) => g.id)).toContain('i77-express');
  });

  it('classify_beforeRefresh_isEmpty', () => {
    const db = { roadGroup: { findMany: jest.fn() } };
    const fresh = new RoadGroupService(db as unknown as DbClient);
    expect(fresh.classify('I-77 EL Exit 16')).toBeNull();
  });
});
