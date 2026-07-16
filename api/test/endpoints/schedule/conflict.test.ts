import { findConflicts, overlaps } from '../../../src/endpoints/schedule/conflict';

const at = (iso: string): Date => new Date(iso);

describe('overlaps', () => {
  it('overlaps_touchingEdges_returnsFalse', () => {
    const a = { start: at('2026-07-15T10:00:00Z'), end: at('2026-07-15T11:00:00Z') };
    const b = { start: at('2026-07-15T11:00:00Z'), end: at('2026-07-15T12:00:00Z') };
    expect(overlaps(a, b)).toBe(false);
  });

  it('overlaps_partialOverlap_returnsTrue', () => {
    const a = { start: at('2026-07-15T10:00:00Z'), end: at('2026-07-15T11:00:00Z') };
    const b = { start: at('2026-07-15T10:30:00Z'), end: at('2026-07-15T11:30:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });

  it('overlaps_containment_returnsTrue', () => {
    const a = { start: at('2026-07-15T10:00:00Z'), end: at('2026-07-15T14:00:00Z') };
    const b = { start: at('2026-07-15T11:00:00Z'), end: at('2026-07-15T12:00:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });
});

describe('findConflicts', () => {
  const adhoc = { start: at('2026-07-15T10:00:00Z'), end: at('2026-07-15T12:00:00Z') };

  it('findConflicts_noOverlap_returnsEmpty', () => {
    const materialized = [
      { id: 'a', start: at('2026-07-15T08:00:00Z'), end: at('2026-07-15T09:00:00Z') },
      { id: 'b', start: at('2026-07-15T13:00:00Z'), end: at('2026-07-15T14:00:00Z') },
    ];
    expect(findConflicts(adhoc, materialized)).toHaveLength(0);
  });

  it('findConflicts_multipleOverlaps_returnsAll', () => {
    const materialized = [
      { id: 'a', start: at('2026-07-15T09:30:00Z'), end: at('2026-07-15T10:30:00Z') },
      { id: 'b', start: at('2026-07-15T11:00:00Z'), end: at('2026-07-15T13:00:00Z') },
      { id: 'c', start: at('2026-07-15T14:00:00Z'), end: at('2026-07-15T15:00:00Z') },
    ];
    const conflicts = findConflicts(adhoc, materialized);
    expect(conflicts.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
