// Rental Aggregation Engine — sync planning (spec section 16).
//
// This is the one piece of decision logic shared between the local dev-mode
// store and the Supabase-backed implementation (see localApi.ts /
// supabaseApi.ts runCsvSync): given what a source already reported before and
// what a new sync run just produced, decide what's new, what's an update to
// something this source already reported, and which existing OTHER
// properties look like possible duplicates. Nothing here touches a database —
// each backend executes the resulting plan with its own storage calls, which
// is what keeps this logic from drifting between the two implementations
// (the same pattern used by lib/match/score.ts and lib/perfectRent/engine.ts
// elsewhere in this app).

import type { ParsedCsvRow, ValidationIssue } from "./csv.ts";
import { findCandidateMatches, type MatchableProperty } from "./matching.ts";

export interface PropertySyncPlanItem {
  sourcePropertyId: string;
  /** null when this is the first time this source has reported this property. */
  existingAggPropertyId: string | null;
  property: ParsedCsvRow["property"];
  units: ParsedCsvRow["unit"][];
  /** Only populated when existingAggPropertyId is null — possible matches
   *  against OTHER already-canonical properties, for admin review. Never
   *  auto-merged (spec sections 5 & 13). */
  duplicateMatches: Array<{ existingPropertyId: string; confidence: number; reasons: string[] }>;
}

export interface SyncPlan {
  items: PropertySyncPlanItem[];
  issues: ValidationIssue[];
}

export interface BuildSyncPlanInput {
  rows: ParsedCsvRow[];
  issues: ValidationIssue[];
  /** source_property_id -> agg_property_id, for THIS source only (i.e. rows
   *  already linked to a canonical property via agg_property_sources). */
  existingSourcePropertyMap: Map<string, string>;
  /** Existing canonical properties to check new records against for possible
   *  duplicates — the caller pre-filters this (e.g. same city/zip) so this
   *  never has to scan the whole table. */
  candidateProperties: MatchableProperty[];
  duplicateMatchThreshold: number;
}

export function buildSyncPlan(input: BuildSyncPlanInput): SyncPlan {
  const { rows, issues, existingSourcePropertyMap, candidateProperties, duplicateMatchThreshold } = input;

  const grouped = new Map<string, { property: ParsedCsvRow["property"]; units: ParsedCsvRow["unit"][] }>();
  for (const row of rows) {
    const key = row.property.source_property_id;
    if (!key) continue; // already flagged as an issue by validateParsedRow
    const existing = grouped.get(key);
    if (existing) {
      existing.units.push(row.unit);
    } else {
      grouped.set(key, { property: row.property, units: [row.unit] });
    }
  }

  const items: PropertySyncPlanItem[] = [];
  for (const [sourcePropertyId, group] of grouped) {
    const existingAggPropertyId = existingSourcePropertyMap.get(sourcePropertyId) ?? null;
    let duplicateMatches: PropertySyncPlanItem["duplicateMatches"] = [];

    if (!existingAggPropertyId) {
      const target: MatchableProperty = {
        id: "__incoming__",
        property_name: group.property.property_name,
        address: group.property.address,
        city: group.property.city,
        state: group.property.state,
        zip: group.property.zip,
        latitude: group.property.latitude,
        longitude: group.property.longitude,
        management_company: group.property.management_company,
        management_contact: group.property.management_contact,
        website: group.property.website,
      };
      duplicateMatches = findCandidateMatches(target, candidateProperties, duplicateMatchThreshold).map((m) => ({
        existingPropertyId: m.property.id,
        confidence: m.result.confidence,
        reasons: m.result.reasons,
      }));
    }

    items.push({ sourcePropertyId, existingAggPropertyId, property: group.property, units: group.units, duplicateMatches });
  }

  return { items, issues };
}
