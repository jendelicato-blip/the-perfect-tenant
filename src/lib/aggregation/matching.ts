// Rental Aggregation Engine — entity matching / duplicate detection
// (spec sections 5 & 13).
//
// This module only ever PROPOSES a match with a confidence score and the
// reasons behind it. It never merges anything itself — the sync pipeline
// writes proposals above the configured threshold into
// agg_duplicate_candidates for an administrator to act on (merge / keep
// separate / ignore). See AdminMergeRentalDuplicate in the data layer for the
// only code path that actually combines two canonical properties.

import { normalizeAddressForMatching } from "./normalize";

export interface MatchableProperty {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  management_company: string | null;
  management_contact: { phone?: string } | null;
  website: string | null;
}

export interface MatchResult {
  confidence: number; // 0..1
  reasons: string[];
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Token-overlap similarity (Jaccard over word sets) — cheap, dependency-free,
// and good enough to catch "Midtown Apartments" vs "Midtown Apartment Homes".
function nameSimilarity(a: string, b: string): number {
  const singularize = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !["the", "at", "of", "on"].includes(w))
        .map(singularize),
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const w of ta) if (tb.has(w)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

// Weighted signal blend (spec section 5's list: address, lat/lng, name,
// phone, management company, website, ... ). Weights are deliberately
// conservative — no single weak signal can push confidence above the default
// review threshold (0.72) on its own.
export function computeMatchConfidence(a: MatchableProperty, b: MatchableProperty): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  const addrA = normalizeAddressForMatching(a.address);
  const addrB = normalizeAddressForMatching(b.address);
  const sameZip = a.zip && b.zip && a.zip === b.zip;
  if (addrA && addrA === addrB && sameZip) {
    // Two listings at the exact same normalized street address and ZIP are
    // very unlikely to be a coincidence, so this signal alone carries most of
    // the weight toward the review threshold — see the worked example in the
    // spec ("Midtown Apartments" / "Midtown Apartment Homes" at "123 Main
    // Street" / "123 Main St.") and the matching test suite.
    score += 0.6;
    reasons.push("address_match");
  } else if (sameZip && a.city.toLowerCase() === b.city.toLowerCase()) {
    // Partial credit: same city/zip but address strings didn't normalize
    // identically (e.g. a typo, or a unit number stuck on the end).
    score += 0.1;
    reasons.push("same_city_zip");
  }

  if (a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
    const distance = haversineMiles(a.latitude, a.longitude, b.latitude, b.longitude);
    if (distance <= 0.03) {
      score += 0.25;
      reasons.push("geo_match");
    } else if (distance <= 0.15) {
      score += 0.1;
      reasons.push("geo_nearby");
    }
  }

  const nameSim = nameSimilarity(a.property_name, b.property_name);
  if (nameSim >= 0.5) {
    score += 0.2 * nameSim;
    reasons.push("name_similar");
  }

  if (a.management_company && b.management_company && a.management_company.toLowerCase() === b.management_company.toLowerCase()) {
    score += 0.1;
    reasons.push("management_company_match");
  }

  const phoneA = normalizePhone(a.management_contact?.phone);
  const phoneB = normalizePhone(b.management_contact?.phone);
  if (phoneA && phoneB && phoneA === phoneB) {
    score += 0.1;
    reasons.push("phone_match");
  }

  if (a.website && b.website && a.website.trim().toLowerCase() === b.website.trim().toLowerCase()) {
    score += 0.1;
    reasons.push("website_match");
  }

  return { confidence: Math.min(1, score), reasons };
}

// Scans candidates (typically properties in the same city/zip — the sync
// pipeline pre-filters before calling this, since comparing against every
// property in the database wouldn't scale) and returns matches at or above
// `threshold`, sorted by confidence descending.
export function findCandidateMatches(
  target: MatchableProperty,
  candidates: MatchableProperty[],
  threshold: number,
): Array<{ property: MatchableProperty; result: MatchResult }> {
  return candidates
    .filter((c) => c.id !== target.id)
    .map((property) => ({ property, result: computeMatchConfidence(target, property) }))
    .filter((m) => m.result.confidence >= threshold)
    .sort((x, y) => y.result.confidence - x.result.confidence);
}
