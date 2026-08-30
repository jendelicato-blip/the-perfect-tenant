import type { MatchReason, Property, TenantArea, TenantPreferences } from "@/types/domain";

// Rule-based match scoring (Phase 1 — no ML). Every input here must stay
// blind to protected characteristics (race, religion, familial status, etc.)
// per the Fair Housing checklist in the build plan: only objective listing
// facts (rent, beds/baths, location, move-in date, pet policy) are scored.

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface MatchResult {
  score: number;
  reasons: MatchReason[];
}

export function scoreMatch(
  prefs: TenantPreferences,
  areas: TenantArea[],
  property: Property,
): MatchResult {
  const reasons: MatchReason[] = [];

  const rentInRange = property.rent >= prefs.min_rent && property.rent <= prefs.max_rent;
  reasons.push({ label: `Rent $${property.rent}/mo is within your $${prefs.min_rent}-$${prefs.max_rent} range`, weight: 30, matched: rentInRange });

  const bedsMatch = property.beds >= prefs.beds;
  reasons.push({ label: `${property.beds} bed(s) meets your ${prefs.beds}+ bed requirement`, weight: 20, matched: bedsMatch });

  const bathsMatch = property.baths >= prefs.baths;
  reasons.push({ label: `${property.baths} bath(s) meets your ${prefs.baths}+ bath requirement`, weight: 10, matched: bathsMatch });

  const typeMatch = prefs.property_types.includes(property.type);
  reasons.push({ label: `Property type "${property.type}" matches your preferences`, weight: 10, matched: typeMatch });

  const inRadius = areas.some(
    (a) => haversineMiles(a.lat, a.lng, property.lat, property.lng) <= a.radius_miles,
  );
  reasons.push({ label: "Within your preferred search radius", weight: 20, matched: inRadius });

  const moveInOk = new Date(property.available_date) <= new Date(prefs.move_in_date);
  reasons.push({ label: `Available by your ${prefs.move_in_date} move-in date`, weight: 5, matched: moveInOk });

  const petsOk =
    !prefs.pets ||
    property.pet_policy === "cats_and_dogs" ||
    property.pet_policy === "cats_only" ||
    property.pet_policy === "dogs_only" ||
    property.pet_policy === "case_by_case";
  reasons.push({ label: "Pet policy compatible with your household", weight: 5, matched: petsOk });

  const totalWeight = reasons.reduce((sum, r) => sum + r.weight, 0);
  const earnedWeight = reasons.reduce((sum, r) => sum + (r.matched ? r.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return { score, reasons };
}
