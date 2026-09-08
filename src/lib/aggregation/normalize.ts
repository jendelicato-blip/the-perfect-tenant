// Rental Aggregation Engine — normalization layer (spec section 4).
//
// Every external source describes the same facts differently ("1BR" / "One
// Bedroom" / "1 Bed" all mean bedrooms=1). These are pure, dependency-free
// functions so they're trivially unit-testable and reusable from any future
// connector — nothing here talks to the database.

export function normalizeBedrooms(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^studio$/.test(s)) return 0;
  const wordMap: Record<string, number> = {
    studio: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  for (const [word, n] of Object.entries(wordMap)) {
    if (s.includes(word)) return n;
  }
  // "1BR", "1 Bed", "1 bd", "1 bedroom"
  const match = s.match(/(\d+(?:\.\d+)?)\s*(?:br|bed|bd|bedroom)/);
  if (match) return Number(match[1]);
  // Bare number
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]);
  return null;
}

export function normalizeBathrooms(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  // "Baths: 2", "2BA", "2 bath", "2.5 baths"
  const match = s.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathroom)?/);
  if (match) return Number(match[1]);
  return null;
}

// Accepts "$1,450/mo", "1450", "$1450.00", "1,450" -> 145000 (cents).
export function normalizeRentToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Math.round(raw * 100);
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function normalizeSquareFeet(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  return Number(cleaned);
}

// "Available Now" -> today's date (ISO). "Available 10/1/26" / "10/1/2026" /
// "2026-10-01" -> ISO date. Unparseable strings return null rather than
// guessing — an availability date the system invented would be worse than
// none (see the app-wide "never fabricate data" principle).
export function normalizeAvailabilityDate(raw: string | null | undefined, today = new Date()): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("now") || s.includes("immediately") || s.includes("immediate")) {
    return today.toISOString().slice(0, 10);
  }
  // ISO format already
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // M/D/YY or M/D/YYYY
  const slash = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const [, m, d, yRaw] = slash;
    const year = yRaw.length === 2 ? Number(yRaw) + 2000 : Number(yRaw);
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  apt: "apartment",
  apartment: "apartment",
  "apartment community": "apartment_community",
  "apartment complex": "apartment_community",
  community: "apartment_community",
  condo: "condo",
  condominium: "condo",
  townhome: "townhome",
  townhouse: "townhome",
  house: "single_family",
  "single family": "single_family",
  "single-family": "single_family",
  "single family home": "single_family",
  sfh: "single_family",
  duplex: "duplex",
  multifamily: "multifamily",
  "multi-family": "multifamily",
  "student housing": "student_housing",
  student: "student_housing",
};

export function normalizePropertyType(raw: string | null | undefined): string {
  if (!raw) return "other";
  const key = raw.trim().toLowerCase();
  return PROPERTY_TYPE_ALIASES[key] ?? "other";
}

// Loose comma/keyword split — good enough for CSV cells like
// "Pool, Fitness Center, Washer/Dryer" or "pool;gym;in-unit laundry".
export function normalizeList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Collapses whitespace/punctuation variance so "123 Main St." and
// "123 Main Street" compare more usefully in the matching engine — this is
// NOT a geocoding-quality normalizer, just enough to help fuzzy matching.
export function normalizeAddressForMatching(address: string): string {
  const suffixMap: Record<string, string> = {
    street: "st",
    st: "st",
    avenue: "ave",
    ave: "ave",
    boulevard: "blvd",
    blvd: "blvd",
    drive: "dr",
    dr: "dr",
    lane: "ln",
    ln: "ln",
    road: "rd",
    rd: "rd",
    court: "ct",
    ct: "ct",
    place: "pl",
    pl: "pl",
    terrace: "ter",
    ter: "ter",
    circle: "cir",
    cir: "cir",
    way: "way",
    parkway: "pkwy",
    pkwy: "pkwy",
  };
  const words = address
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => suffixMap[w] ?? w);
  return words.join(" ").trim();
}
