import { propertyHasParking, type MatchReason, type Property, type Tenant, type TenantArea, type TenantPreferences } from "@/types/domain";

// Perfect Match™ — rule-based scoring (Phase 1 — no ML). Every input here
// must stay blind to protected characteristics (race, religion, familial
// status, etc.) per the Fair Housing checklist: only objective, lawful
// rental criteria (rent, beds/baths, location, move-in date, lease length,
// pet policy, parking, amenities) are scored. Never add an input derived
// from a protected characteristic.

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
  tenant: Pick<Tenant, "lease_pref_months">,
  prefs: TenantPreferences,
  areas: TenantArea[],
  property: Property,
): MatchResult {
  const reasons: MatchReason[] = [];

  const rentInRange = property.rent >= prefs.min_rent && property.rent <= prefs.max_rent;
  reasons.push({ label: `Rent $${property.rent}/mo is within your $${prefs.min_rent}-$${prefs.max_rent} range`, weight: 22, matched: rentInRange });

  const bedsMatch = property.beds >= prefs.beds;
  reasons.push({ label: `${property.beds} bed(s) meets your ${prefs.beds}+ bed requirement`, weight: 14, matched: bedsMatch });

  const bathsMatch = property.baths >= prefs.baths;
  reasons.push({ label: `${property.baths} bath(s) meets your ${prefs.baths}+ bath requirement`, weight: 7, matched: bathsMatch });

  const typeMatch = prefs.property_types.includes(property.type);
  reasons.push({ label: `Property type "${property.type}" matches your preferences`, weight: 7, matched: typeMatch });

  const inRadius = areas.some(
    (a) => haversineMiles(a.lat, a.lng, property.lat, property.lng) <= a.radius_miles,
  );
  reasons.push({ label: "Within your preferred search radius", weight: 14, matched: inRadius });

  const moveInOk = new Date(property.available_date) <= new Date(prefs.move_in_date);
  reasons.push({ label: `Available by your ${prefs.move_in_date} move-in date`, weight: 7, matched: moveInOk });

  const petsOk =
    !prefs.pets ||
    property.pet_policy === "cats_and_dogs" ||
    property.pet_policy === "cats_only" ||
    property.pet_policy === "dogs_only" ||
    property.pet_policy === "case_by_case";
  reasons.push({ label: "Pet policy compatible with your household", weight: 6, matched: petsOk });

  const leaseMatch = !tenant.lease_pref_months || tenant.lease_pref_months === property.lease_term_months;
  reasons.push({
    label: tenant.lease_pref_months
      ? `${property.lease_term_months}-month lease matches your ${tenant.lease_pref_months}-month preference`
      : "No lease-length preference set",
    weight: 6,
    matched: leaseMatch,
  });

  const parkingOk = !prefs.parking_required || propertyHasParking(property);
  reasons.push({ label: "Has parking", weight: 6, matched: parkingOk });

  const desiredAmenities = prefs.desired_amenities ?? [];
  const amenitiesMatch =
    desiredAmenities.length === 0 ||
    desiredAmenities.some((wanted) => property.amenities.some((a) => a.toLowerCase().includes(wanted.toLowerCase())));
  reasons.push({
    label: desiredAmenities.length ? `Has at least one desired amenity (${desiredAmenities.join(", ")})` : "No specific amenities requested",
    weight: 6,
    matched: amenitiesMatch,
  });

  const totalWeight = reasons.reduce((sum, r) => sum + r.weight, 0);
  const earnedWeight = reasons.reduce((sum, r) => sum + (r.matched ? r.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return { score, reasons };
}
