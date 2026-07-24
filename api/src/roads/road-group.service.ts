import { Injectable } from '@nestjs/common';

/** A named group of roads/lanes, matched by keyword against a toll's exit location. */
export interface RoadGroup {
  /** Stable id, safe to reference from the UI or persist. */
  id: string;
  /** Human-readable label, e.g. "I-77 Express Lanes". */
  label: string;
  /** Case-insensitive substrings that identify this group in an exit-location string. */
  keywords: string[];
  /** Whether tolls here can be declared HOV (so a charge may be disputable). */
  hovEligible: boolean;
}

/**
 * The known road groups. Hard-coded for now, but the shape is deliberately
 * data-driven: new roads/keywords are one entry, and this can move to config or
 * the database as coverage grows beyond the NC roads we know today.
 */
const ROAD_GROUPS: RoadGroup[] = [
  {
    id: 'i77-express',
    label: 'I-77 Express Lanes',
    keywords: ['77 EL'],
    hovEligible: true,
  },
];

/**
 * Owns road classification — "which road is this toll on" and "is it HOV-eligible"
 * — in one place so new roads and groupings are easy to add. Injected wherever a
 * toll's location needs to be understood.
 */
@Injectable()
export class RoadGroupService {
  /** All configured road groups. */
  groups(): RoadGroup[] {
    return ROAD_GROUPS;
  }

  /** The road group a location belongs to, or null if none match. */
  classify(exitLocation: string | null | undefined): RoadGroup | null {
    const haystack = (exitLocation ?? '').toLowerCase();
    if (!haystack) return null;
    return (
      ROAD_GROUPS.find((g) => g.keywords.some((k) => haystack.includes(k.toLowerCase()))) ?? null
    );
  }

  /** True when a toll on this location could have been declared HOV. */
  isHovEligible(exitLocation: string | null | undefined): boolean {
    return this.classify(exitLocation)?.hovEligible ?? false;
  }
}
