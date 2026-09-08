// Rental Aggregation Engine — CSV ingestion (the one connector implemented in
// this phase; see connector.ts for why).
//
// The CSV shape mirrors the universal property/unit model from the spec: one
// row per unit, with the owning property's fields repeated on every row for
// that property (the common flat-export shape most PMS/CSV exports use).
// A property with 6 available units simply appears as 6 rows sharing the
// same source_property_id.

import {
  normalizeAvailabilityDate,
  normalizeBathrooms,
  normalizeBedrooms,
  normalizeList,
  normalizePropertyType,
  normalizeRentToCents,
  normalizeSquareFeet,
} from "./normalize.ts";
// Duplicated from src/types/domain.ts (see the note at the top of
// normalize.ts about why this file set is a tracked duplicate) — kept as
// plain string-union types since this bundle has no access to the app's own
// type-only imports.
export type AggPropertyType =
  | "apartment_community"
  | "apartment"
  | "condo"
  | "townhome"
  | "single_family"
  | "duplex"
  | "multifamily"
  | "student_housing"
  | "other";
export type AggAvailabilityStatus =
  | "available"
  | "available_soon"
  | "contact_for_availability"
  | "application_pending"
  | "rented"
  | "leased"
  | "unavailable"
  | "expired"
  | "needs_verification";
export interface AggPetPolicy {
  dogs_allowed?: boolean;
  cats_allowed?: boolean;
  notes?: string;
}

export interface NormalizedPropertyRecord {
  property_name: string;
  property_type: AggPropertyType;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  description: string | null;
  year_built: number | null;
  total_units: number | null;
  amenities: string[];
  pet_policy: AggPetPolicy;
  parking: string | null;
  utilities: string[];
  website: string | null;
  management_company: string | null;
  management_contact: { name?: string; phone?: string; email?: string };
  source_property_id: string;
  source_url: string | null;
  raw_data: Record<string, string>;
}

export interface NormalizedUnitRecord {
  unit_number: string | null;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  monthly_rent_cents: number | null;
  rent_min_cents: number | null;
  rent_max_cents: number | null;
  deposit_cents: number | null;
  available_date: string | null;
  lease_term: string | null;
  furnished: boolean;
  pets_allowed: AggPetPolicy;
  parking: string | null;
  utilities: string[];
  unit_amenities: string[];
  availability_status: AggAvailabilityStatus;
  source_unit_id: string;
  source_url: string | null;
  raw_data: Record<string, string>;
}

export interface ParsedCsvRow {
  property: NormalizedPropertyRecord;
  unit: NormalizedUnitRecord;
}

export interface ValidationIssue {
  rowIndex: number;
  field?: string;
  message: string;
}

// Minimal RFC4180-style parser: handles quoted fields, embedded commas, and
// doubled-quote escaping ("" inside a quoted field). Deliberately not a
// dependency — the format this connector accepts is narrow and controlled by
// the admin uploading it.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const filtered = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (filtered.length === 0) return [];
  const header = filtered[0].map((h) => h.trim());
  return filtered.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function bool(v: string | undefined): boolean {
  if (!v) return false;
  return ["true", "yes", "1", "y"].includes(v.trim().toLowerCase());
}

function normalizeAvailabilityStatus(raw: string | undefined): AggAvailabilityStatus {
  const s = (raw ?? "").trim().toLowerCase();
  const map: Record<string, AggAvailabilityStatus> = {
    available: "available",
    "available now": "available",
    "available soon": "available_soon",
    "contact for availability": "contact_for_availability",
    "application pending": "application_pending",
    rented: "rented",
    leased: "leased",
    unavailable: "unavailable",
    expired: "expired",
  };
  return map[s] ?? "needs_verification";
}

// Converts one CSV row into the normalized property + unit records this
// source reports. `raw_data` on each keeps the untouched row for provenance
// (spec section 15) — nothing here is thrown away, only interpreted.
export function normalizeCsvRow(row: Record<string, string>): ParsedCsvRow {
  const property: NormalizedPropertyRecord = {
    property_name: row.property_name ?? "",
    property_type: normalizePropertyType(row.property_type) as AggPropertyType,
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip: row.zip ?? "",
    county: row.county || null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    neighborhood: row.neighborhood || null,
    description: row.description || null,
    year_built: num(row.year_built),
    total_units: num(row.total_units),
    amenities: normalizeList(row.amenities),
    pet_policy: {
      dogs_allowed: row.pet_policy ? /dog/i.test(row.pet_policy) : undefined,
      cats_allowed: row.pet_policy ? /cat/i.test(row.pet_policy) : undefined,
      notes: row.pet_policy || undefined,
    },
    parking: row.parking || null,
    utilities: normalizeList(row.utilities),
    website: row.website || null,
    management_company: row.management_company || null,
    management_contact: {
      name: row.management_contact_name || undefined,
      phone: row.management_contact_phone || undefined,
      email: row.management_contact_email || undefined,
    },
    source_property_id: row.source_property_id ?? "",
    source_url: row.source_url || null,
    raw_data: row,
  };

  const unit: NormalizedUnitRecord = {
    unit_number: row.unit_number || null,
    floor: num(row.floor),
    bedrooms: normalizeBedrooms(row.bedrooms),
    bathrooms: normalizeBathrooms(row.bathrooms),
    square_feet: normalizeSquareFeet(row.square_feet),
    monthly_rent_cents: normalizeRentToCents(row.monthly_rent),
    rent_min_cents: normalizeRentToCents(row.rent_min),
    rent_max_cents: normalizeRentToCents(row.rent_max),
    deposit_cents: normalizeRentToCents(row.deposit),
    available_date: normalizeAvailabilityDate(row.available_date),
    lease_term: row.lease_term || null,
    furnished: bool(row.furnished),
    pets_allowed: {
      dogs_allowed: row.pets_allowed ? /dog/i.test(row.pets_allowed) : undefined,
      cats_allowed: row.pets_allowed ? /cat/i.test(row.pets_allowed) : undefined,
    },
    parking: row.unit_parking || null,
    utilities: normalizeList(row.unit_utilities),
    unit_amenities: normalizeList(row.unit_amenities),
    availability_status: normalizeAvailabilityStatus(row.availability_status),
    source_unit_id: row.source_unit_id || `${row.source_property_id ?? ""}-${row.unit_number ?? "unit"}`,
    source_url: row.unit_source_url || row.source_url || null,
    raw_data: row,
  };

  return { property, unit };
}

export function validateParsedRow(row: ParsedCsvRow, rowIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const p = row.property;
  if (!p.property_name.trim()) issues.push({ rowIndex, field: "property_name", message: "Missing property_name" });
  if (!p.address.trim()) issues.push({ rowIndex, field: "address", message: "Missing address" });
  if (!p.city.trim()) issues.push({ rowIndex, field: "city", message: "Missing city" });
  if (!p.state.trim()) issues.push({ rowIndex, field: "state", message: "Missing state" });
  if (!p.zip.trim()) issues.push({ rowIndex, field: "zip", message: "Missing zip" });
  if (!p.source_property_id.trim()) issues.push({ rowIndex, field: "source_property_id", message: "Missing source_property_id" });
  if (!row.unit.source_unit_id.trim()) issues.push({ rowIndex, field: "source_unit_id", message: "Missing source_unit_id" });
  return issues;
}
