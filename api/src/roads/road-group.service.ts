import { Injectable, OnModuleInit } from '@nestjs/common';
import { DbClient } from '../database/db-client';

/** A named group of roads/lanes, matched by keyword against a toll's exit location. */
export interface RoadGroup {
  /** Stable slug, safe to reference from the UI or persist. */
  id: string;
  /** Human-readable label, e.g. "I-77". */
  label: string;
  /** Case-insensitive substrings that identify this group in an exit-location string. */
  keywords: string[];
  /** Whether tolls here can be declared HOV (so a charge may be disputable). */
  hovEligible: boolean;
}

/**
 * Owns road classification — "which road is this toll on" and "is it HOV-eligible".
 * Road groups live in the database (seeded via prisma/seed.ts) and are cached in
 * memory at startup, so classification is a fast synchronous lookup with no
 * per-toll query. Call refresh() after mutating groups to pick up changes.
 */
@Injectable()
export class RoadGroupService implements OnModuleInit {
  private cache: RoadGroup[] = [];

  constructor(private readonly db: DbClient) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  /** Reload the cache from the database. */
  async refresh(): Promise<void> {
    const rows = await this.db.roadGroup.findMany({ orderBy: { sortOrder: 'asc' } });
    this.cache = rows.map((r) => ({
      id: r.id,
      label: r.label,
      keywords: r.keywords,
      hovEligible: r.hovEligible,
    }));
  }

  /** All configured road groups. */
  groups(): RoadGroup[] {
    return this.cache;
  }

  /** The road group a location belongs to, or null if none match. */
  classify(exitLocation: string | null | undefined): RoadGroup | null {
    const haystack = (exitLocation ?? '').toLowerCase();
    if (!haystack) return null;
    return (
      this.cache.find((g) => g.keywords.some((k) => haystack.includes(k.toLowerCase()))) ?? null
    );
  }

  /** True when a toll on this location could have been declared HOV. */
  isHovEligible(exitLocation: string | null | undefined): boolean {
    return this.classify(exitLocation)?.hovEligible ?? false;
  }
}
