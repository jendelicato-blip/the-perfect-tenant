// Duplicated from src/lib/aggregation/normalize.ts — Supabase Edge Functions
// deploy as an isolated file set (no shared import across the Deno/browser
// boundary into the app's own src/ tree), so this is a deliberate, tracked
// duplication. Keep this file in sync with the browser copy if either
// changes; nothing here is Deno-specific, so a diff should be a pure copy.

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
  const match = s.match(/(\d+(?:\.\d+)?)\s*(?:br|bed|bd|bedroom)/);
  if (match) return Number(match[1]);
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Number(bare[1]);
  return null;
}

export function normalizeBathrooms(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const match = s.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathroom)?/);
  if (match) return Number(match[1]);
  return null;
}

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

export function normalizeAvailabilityDate(raw: string | null | undefined, today = new Date()): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("now") || s.includes("immediately") || s.includes("immediate")) {
    return today.toISOString().slice(0, 10);
  }
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
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

export function normalizeList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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
