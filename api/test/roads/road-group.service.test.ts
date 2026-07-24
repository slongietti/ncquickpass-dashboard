import { RoadGroupService } from '../../src/roads/road-group.service';

describe('RoadGroupService', () => {
  const service = new RoadGroupService();

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

  it('groups_returnsConfiguredGroups', () => {
    expect(service.groups().map((g) => g.id)).toContain('i77-express');
  });
});
