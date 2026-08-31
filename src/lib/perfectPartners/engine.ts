// Perfect Partners™ placement engine. Both functions here are pure and
// operate only on results computed elsewhere — neither one ever computes,
// reads, or writes a Perfect Match™ score. A sponsored property keeps
// exactly the score/reasons it was given; this module only decides where it
// appears in the list and that it's labeled "Sponsored" when it does.
// See supabase/migrations/0006_perfect_partners.sql for the compliance
// rationale (money changes visibility, never match quality).

import type { AdFrequencyRules, PartnerOffer } from "@/types/domain";

export interface Placeable {
  property: { id: string };
}

export type WithSponsorFlag<T> = T & { sponsored: boolean };

// Takes an already-scored, already-ordered result list (score/reasons
// computed once, upstream, by the same scoreMatch() every tenant's organic
// results use) and promotes up to `rules.max_sponsored_properties_per_page`
// sponsored properties to a more prominent position. A promoted entry keeps
// its exact original `score` — this function only ever changes an entry's
// position and adds `sponsored: true`, never its score. `ads_enabled =
// false` (or the cap being 0) disables promotion entirely, leaving the
// organic order untouched.
export function interleaveSponsoredProperties<T extends Placeable>(
  scored: T[],
  sponsoredPropertyIds: ReadonlySet<string>,
  rules: Pick<AdFrequencyRules, "max_sponsored_properties_per_page" | "ads_enabled">,
): WithSponsorFlag<T>[] {
  const tagged: WithSponsorFlag<T>[] = scored.map((entry) => ({ ...entry, sponsored: false }));
  if (!rules.ads_enabled || rules.max_sponsored_properties_per_page <= 0 || sponsoredPropertyIds.size === 0) {
    return tagged;
  }

  const promoted: WithSponsorFlag<T>[] = [];
  const rest: WithSponsorFlag<T>[] = [];
  for (const entry of tagged) {
    if (promoted.length < rules.max_sponsored_properties_per_page && sponsoredPropertyIds.has(entry.property.id)) {
      promoted.push({ ...entry, sponsored: true });
    } else {
      rest.push(entry);
    }
  }
  if (promoted.length === 0) return tagged;

  // A sponsored listing may appear more prominently than its raw rank would
  // put it, but never above the very top organic result.
  const insertAt = Math.min(2, rest.length);
  return [...rest.slice(0, insertAt), ...promoted, ...rest.slice(insertAt)];
}

// Caps how many Perfect Partner offer cards render on one page/screen — the
// actual mechanism behind "maximum one small sponsored advertisement per
// normal browsing screen" rather than a convention pages are trusted to follow.
export function selectPartnerOffers(
  offers: PartnerOffer[],
  rules: Pick<AdFrequencyRules, "max_partner_cards_per_page" | "ads_enabled">,
): PartnerOffer[] {
  if (!rules.ads_enabled) return [];
  const now = Date.now();
  const eligible = offers.filter((o) => o.active && (!o.expires_at || new Date(o.expires_at).getTime() > now));
  return eligible.slice(0, Math.max(0, rules.max_partner_cards_per_page));
}
