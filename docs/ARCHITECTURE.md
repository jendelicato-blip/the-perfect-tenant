# Architecture

## Data layer: two backends, one facade

Every page and component calls into `src/lib/data/api.ts`. It picks one of two implementations
at module load time, based on whether `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set:

- `src/lib/data/localApi.ts` — local dev-mode, backed by `localStore.ts`
  (`localStorage`, seeded from `src/data/seed/`). Zero setup, used when Supabase isn't
  configured.
- `src/lib/data/supabaseApi.ts` — the live Supabase project, using `supabase.auth.*` and
  `supabase.from(...)` against the schema in `supabase/migrations/`.

Both implementations share their types from `src/lib/data/types.ts` (`AuthUser`,
`PropertyFilter`, `NewProperty`, `ScoredProperty`, `StartCheckout`, `MarketplaceTenant`,
`NewLandlordReview`), which is what lets `src/pages/` and `src/components/` stay identical
regardless of which backend is active — they only ever import from `api.ts`.

A Supabase project (`the-perfect-tenant`, ref `xbpsuwmmpqltnifmjptb`) is already provisioned
with every migration applied and demo accounts/data seeded (see the README for credentials). To
point at a *different* project instead, apply every file in `supabase/migrations/` to it in
order, and set the env vars in `.env.local` (see `.env.example`).

## Rental Ready: always derived, never stored

`computeRentalReady` (`src/types/domain.ts`) takes a `TenantVerificationSummary` (8 categories:
identity, income, employment, rental history, credit, background, eviction, references) and
returns 🟢 rental_ready / 🟡 almost_ready / 🔴 action_required plus the specific next step. It is
a pure function called wherever the badge is shown (Passport, Verification Center, Tenant
Marketplace, Applicants, Saved Tenants) — there is deliberately no `rental_ready` column
anywhere. Storing it as a cached field would let it drift from the verification data it's
supposed to summarize; recomputing it is cheap and always correct.

## Tenant Marketplace visibility

`tenants.passport_visibility` (`marketplace` / `applied_or_saved_only` / `private`, tenant-
controlled from Onboarding) is what the two-sided marketplace is actually built on.
`tenant_public_profile`'s `WHERE` clause (see `0004_tenant_marketplace_visibility.sql`) grants a
landlord read access to a tenant's status-level profile when: the tenant is the caller
themselves, `passport_visibility = 'marketplace'` (fully opted in — the default), or
`passport_visibility = 'applied_or_saved_only'` AND that landlord has an existing
application/saved relationship with the tenant. `private` is visible to no one but the tenant. A
matching second policy on `tenant_areas` (same predicate, since that table has no visibility
column of its own) is what lets `listMarketplaceTenants` also read a marketplace tenant's
search areas without granting broader table access.

`api.listMarketplaceTenants(landlordId, propertyId?)` reads this view, filters to tenants
verified across all 8 categories (Rental Ready), and — when a `propertyId` is given — scores
each against that property with the same `scoreMatch` engine tenants use for their own matches
(symmetric: Perfect Match™ is one engine, called from both directions).

## Row Level Security model

- Every tenant-owned table (`tenants`, `tenant_preferences`, `tenant_areas`, `tenant_pets`, and
  every verification table) has a single `tenant_id = auth.uid()` (or `user_id = auth.uid()`)
  policy: only the tenant themselves can read or write their own sensitive data.
- Landlords never get a policy granting them direct access to verification base tables. Instead,
  `tenant_public_profile` is a `security_barrier` view with `security_invoker = false` whose own
  `WHERE` clause encodes the actual authorization rule: a row is visible to a landlord only if
  that tenant applied to one of their properties, or the landlord explicitly saved that tenant.
  The view projects verification *status* columns only — never `provider`, `report_ref`, or any
  other column from the base tables.
- `properties` is publicly readable when `status = 'active'`; all other states (draft, paused,
  leased) are owner-only.
- `applications` and `conversations`/`messages` use `EXISTS` subqueries against `properties` to
  scope landlord access to their own listings' applicants and conversations.
- `tenant_invitations`, `tenant_interests`, `passport_shares`, `passport_views` follow the same
  pattern: owner (tenant or landlord, whichever initiated the row) gets an `all` policy, the
  other party gets a scoped `select` policy via an `EXISTS` check.
- `landlord_reviews` is publicly readable (reviews are meant to be seen), but insert is gated on
  the tenant having an *approved* application with that landlord for that property.
- `subscription_plans` is publicly readable when `active`; writes require
  `public.users.is_admin = true` — this is what makes pricing "never hard-coded" actually true
  end-to-end, not just true in the UI layer.

**Do not** add a table or column exposing tenant PII/screening data without adding both an
owner-only RLS policy and, if landlords need any visibility into it, extending
`tenant_public_profile` rather than granting broader table access.

## Billing: Stripe Checkout via Edge Functions

`api.startCheckout(landlordId, tier)` is the entry point (called from the Pricing page). In
local dev-mode it always returns `null`, so the page falls back to `setSubscriptionTier` (Phase
1 stub — no payment collection). Against Supabase, it invokes the `stripe-checkout` Edge
Function, which:

1. Verifies the caller via their Supabase JWT (`verify_jwt = true` on the function) and confirms
   they're a landlord.
2. Finds or creates a Stripe customer for them (id cached in `subscriptions.stripe_customer_id`).
3. Creates a Checkout Session for the requested tier's price and returns its URL for the client
   to redirect to.

`stripe-webhook` (`verify_jwt = false` — Stripe authenticates via the `Stripe-Signature` header
instead) handles `checkout.session.completed`, `customer.subscription.updated`, and
`customer.subscription.deleted`, updating `subscriptions.tier`/`status`/`renews_at` and
`landlords.subscription_tier` using the service role (bypassing RLS, since Stripe isn't an
authenticated Supabase user). Both functions read Stripe secrets from Edge Function env vars —
see the README's "Stripe billing" section for which ones to set and where.

If `stripe-checkout` returns an error (e.g. no price configured for a tier because secrets
aren't set yet), `api.startCheckout` returns `null` rather than throwing, so the UI degrades to
the same stub behavior as local dev-mode instead of showing a hard failure.

## Perfect Match™ scoring

`src/lib/match/score.ts` is intentionally simple and rule-based (Phase 1 scope — no ML). Every
scored input is an objective, lawful rental fact: rent-in-range, beds/baths minimums, property
type, search-radius distance (haversine), move-in date, lease-length match, pet-policy
compatibility, parking (`propertyHasParking` in `domain.ts`, keyword-matched against
`amenities`), and desired-amenities overlap. `scoreMatch(tenant, prefs, areas, property)` is the
one function called from both directions — a tenant's own matches and a landlord scoring a
marketplace tenant against a listing — so there is exactly one scoring implementation to keep
Fair-Housing-safe, not two that could drift apart. Do not add a scoring input derived from a
protected characteristic (familial status, source of income where prohibited, etc.) — see the
Fair Housing checklist in the original build plan.

## Perfect Rent™, Perfect Pay™, Perfect Rewards™

These three features share one rule: **never fabricate a number, never guarantee an unconfirmed
outcome.** Each is built as a pure computation over real rows, called identically from the
landlord editor, the tenant-facing calculator, and the admin analytics — never three separate
implementations that could quietly disagree.

### Perfect Rent™: incentive engine + jurisdiction gate

`rent_incentives` (one row per `property_id` + `incentive_type`) is landlord-configured — see
`RentIncentiveEditor.tsx`. `computePerfectRent` (`src/lib/perfectRent/engine.ts`) is the single
calculator: given a property's base rent, its active incentives, and a tenant's actual
qualification facts (Rental Ready status, chosen lease length vs. the property's term, their real
`auto_payment_enrolled` flag, whether their rental history is verified), it returns each
incentive's status —

- `applied` — the tenant qualifies right now, and the discount is reflected in the quoted rent.
- `available` — offered on this property, but the tenant doesn't yet qualify (e.g. not Rental
  Ready) — shown so they know what would unlock it, not counted in the quote.
- `unavailable_location` — blocked by the jurisdiction gate (below); shown, not hidden, so a
  landlord can't quietly re-offer something the platform has determined is unsafe there.
- `requires_landlord_confirmation` — `upfront_rent` *only*. This type is never auto-applied to
  `estimatedRentCents`, no matter how well a tenant qualifies; an upfront-rent arrangement is a
  negotiation between landlord and tenant, not something the platform can quote as a fixed
  discount. This is also why there is no deposit/prepaid-rent feature anywhere in the schema:
  deposit limits are jurisdiction-specific and legally sensitive in a way this engine is not
  positioned to adjudicate — see the comment in `0005_perfect_rent_pay_rewards.sql`.

Every caller (`PerfectRentCalculator.tsx`, `PerfectRentBadge.tsx`, `Rewards.tsx`) always renders
Base Rent alongside the computed Potential Incentivized Rent side by side — never the discounted
number alone — so a tenant can never mistake a potential incentive for a locked-in price.

`buildJurisdictionAllowed` (`src/lib/perfectRent/jurisdiction.ts`) checks `jurisdiction_rules` for
a `(state, incentive_type)` block and defaults to **allowed** when no row exists — permissive by
default, since most jurisdictions have no real rule seeded yet (see README Compliance notes: this
is a working mechanism, not real legal research). `computePerfectRent` runs every incentive
through this gate before evaluating tenant qualification, so a blocked type can never reach
`applied` regardless of how the landlord configured it.

### Perfect Pay™: landlord-confirmed payments only

`payment_verifications` rows are created exactly one way: a landlord calling
`recordPayment(tenantId, propertyId, periodStart, status)` from `/landlord/applicants` for an
approved applicant. There is no payment processor integration and no path by which the platform
marks a payment "verified" on its own — this is a deliberate reading of the payment-data rule in
the build plan (only a legitimate source, and landlord confirmation is the only one implemented,
may mark a payment verified).

`computeOnTimeStreak` (`src/types/domain.ts`) sorts a tenant's payments by period and counts
consecutive `on_time` entries from the most recent, stopping at the first gap or non-`on_time`
status. `computePerfectPayLevel(streak, milestones)` maps that streak against
`perfect_pay_milestones` (`consecutive_payments_required` per level, admin-editable at `/admin`,
never hard-coded in the client) to produce the tenant's current level and the next one up.
`recordPayment` also checks whether the new streak just crossed a milestone threshold and, only
then, inserts a `reward_events` row and fires a one-time notification (`notifyOnce`) — a milestone
is only ever recorded once a landlord's confirmation actually reaches it, never speculatively.

### Perfect Pay™ Autopay: a simulated payment-provider layer, not a new payment fact

The Autopay work added in this pass (`PerfectPaySetup.tsx`, `/perfect-pay`, `/landlord/rent-collection`,
`/landlord/perfect-pay-settings`) is deliberately a UX/data layer sitting *on top of* the existing
landlord-confirmed `payment_verifications` mechanism above — it never becomes a second, competing
source of truth for "did the tenant pay." `Tenant.payment_method_type`/`payment_method_last4` are
what a real tokenizing payment provider (Stripe Connect or similar — see the migration comment in
`0007_perfect_pay_autopay.sql`) would hand back; no real bank/card number is ever collected. Turning
Autopay on/off still only ever flips `auto_payment_enrolled`, the same field the Perfect Rent™ engine
already read before this phase — so a tenant who enables Autopay immediately qualifies for any
`auto_payment` incentive the same way they always did, and a "next payment" shown on `/perfect-pay`
is a projection computed from `computeNextAutopayDate` + the current Perfect Rent™ quote, never a row
implying money has moved. Similarly, `landlord_payout_accounts.connected` is a simulated instant flag
— a real integration would redirect to the provider's own onboarding and only flip this from a
webhook once that flow actually completes.

`RentIncentive.funded_by` (`landlord` | `platform`) makes explicit who actually absorbs an enabled
incentive's cost — `RentIncentiveEditor.tsx`'s "Your cost" preview only sums landlord-funded
incentives, since a platform-funded one costs the landlord nothing (they're paid full rent either
way). `platform_fee_config` is a singleton config row (same pattern as `ad_frequency_rules`),
admin-editable at `/admin`, disclosed to landlords at `/landlord/perfect-pay-settings` — never
hard-coded, and importantly never actually deducted anywhere in this phase since there's no real
payment rail moving money to deduct a fee from.

`/landlord/rent-collection`'s per-tenant Perfect Pay level and `LandlordTenantPassportView.tsx`'s
restricted Perfect Pay card both deliberately read only `listPaymentVerificationsForLandlord` (RLS:
`landlord_id = auth.uid()`) — i.e. only payments *this* landlord themselves confirmed. A tenant's
Perfect Pay history is designed to follow them across properties (their milestone is computed from
`payment_verifications.tenant_id`, not scoped to one property), but making that history visible to a
landlord who *didn't* record any of it — e.g. a stranger landlord scanning a Passport share link —
needs a real public-safe aggregate view (like `tenant_public_profile` for verification statuses).
That view doesn't exist yet, so a landlord with zero payment_verifications rows for a tenant simply
sees no Perfect Pay card at all, rather than an incorrect "New" showing zero history for a tenant who
may have an established one elsewhere.

### Payout History & Reconciliation Reporting: computed, not a second ledger

`/landlord/payouts` (`src/lib/perfectPay/reconciliation.ts`) introduces no new source of truth for
money — it's a read model over data the landlord already has full legitimate access to: their own
`payment_verifications` (RLS: `landlord_id = auth.uid()`), their own properties' `rent_incentives`,
and the current `platform_fee_config`. `groupPayoutPeriods` always groups by calendar month, never
by the landlord's configured `payout_schedule` (daily/weekly/monthly) — `payment_verifications` only
ever records one row per month of rent (see `recordPayment`), so there's no sub-monthly structure in
the real data to group by; `payout_schedule` describes how a real integration would time
disbursements, not something this data can be split into without inventing it. Every payout period
carries the label "✓ Reflects confirmed rent," deliberately not "Paid" or "Transferred" — no bank
transfer or settlement event backs any of this.

The Monthly Collection Report's "Autopay rate" needed one new, narrowly-scoped visibility grant:
`landlord_visible_autopay` (`0008_landlord_autopay_visibility.sql`), a security-barrier view in the
same pattern as `tenant_public_profile` (own WHERE-clause access control, not RLS re-inheritance —
flagged by the same accepted `security_definer_view` lint), but scoped narrower: it exposes only
`auto_payment_enrolled`, and only for tenants with an approved application on a property the querying
landlord owns (`p.landlord_id = auth.uid()` inside the view body). `payment_method_type`/`last4` are
deliberately not in it — those stay private per the existing note on `LandlordPayoutAccount`/`Tenant`.
Incentive totals in the report are the landlord's own configured `rent_incentives` split by
`funded_by`, not attributed to any specific tenant's payment — `payment_verifications` doesn't record
which incentives applied to a given confirmed payment, so this reports "what's configured," never
"what was deducted from this specific payout."

### Perfect Rewards™: a read-only scorecard, not a new data model

`/rewards` (`Rewards.tsx`) introduces no new source of truth — it composes Rental Ready
(`computeRentalReady`), Perfect Pay level (`computePerfectPayLevel`), verified rental history (from
the existing verification tables), and Perfect Rent™ potential savings (`computePerfectRent`
against the tenant's saved/applied properties) into one view. Achievement badges are professional
labels over real thresholds (e.g. "Rental Ready," "Bronze Payer") — deliberately not a points/XP
game. The "Coming Soon" categories shown here are the ones with no seeded Perfect Partners™ yet;
real partner categories (see below) now render as actual, working offer cards rather than
placeholders — the placeholder styling stays reserved for whichever categories still have no real
partnership behind them.

## Perfect Partners™: the advertising/monetization engine

One rule governs everything in this section, enforced structurally rather than by convention:
**paid placement can change VISIBILITY, never the Perfect Match™ score.**

### The non-negotiable boundary

`interleaveSponsoredProperties(scored, sponsoredPropertyIds, rules)`
(`src/lib/perfectPartners/engine.ts`) is the only place a sponsored property's position in a
result list changes. It takes an array already scored by `scoreMatch()` — the exact same call
every organic result went through — and its only two effects are (1) moving up to
`rules.max_sponsored_properties_per_page` matching entries to a more prominent slot and (2)
tagging them `sponsored: true`. There is no parameter through which a caller could pass a
different score, and the function never calls `scoreMatch` itself. `Matches.tsx` calls it with
the tenant's real scored results plus the set of property IDs with an active sponsored campaign;
`PropertyCard`/`Search.tsx` render the same `score` field whether or not `sponsored` is set. This
is what makes "a property that's objectively a 91% match remains a 91% match whether the landlord
pays for promotion or not" true in code, not just in copy.

`selectPartnerOffers(offers, rules)` is the equivalent cap for the Perfect Partners directory: it
filters to active, non-expired offers and slices to `rules.max_partner_cards_per_page` — the
actual mechanism behind "useful, relevant, never overwhelming," not just a design intention.

### Sponsored Property lifecycle

1. A landlord opens their property's edit page and picks an admin-priced `ad_packages` row (7-Day
   Boost/14-Day Featured/30-Day Featured/Premium Featured — `PromotePropertyPanel.tsx`).
2. `createSponsoredPropertyCampaign` lazily creates (or reuses) the landlord's one `advertisers`
   row via `getOrCreateAdvertiserForLandlord` — there's no separate third-party advertiser signup
   flow in this pass, only this self-promotion path — and inserts an `ad_campaigns` row with
   `status = 'pending_review'`, `campaign_type = 'sponsored_property'`, and geography copied
   straight from the property (a sponsored property's location *is* the property's own location,
   not a separately configurable target).
3. Nothing is visible to any tenant yet: the RLS policy tenants read through
   (`ad_campaigns_public_read_active`) only ever returns rows where `status = 'approved'` and the
   current time falls within `starts_at`/`ends_at`.
4. An admin reviews the queue at `/admin` and calls `reviewCampaign(id, "approved" | "rejected")`.
   Approving is the one action that (a) sets real `starts_at = now()` /
   `ends_at = now() + package.duration_days`, and (b) inserts a real `ad_revenue_events` row from
   the package's real `price_cents` — never a fabricated number, the same pattern as
   `subscription_plans` price × active-subscriber count driving MRR. No payment is actually
   collected (see "What's deferred" in the README) — this is a Phase 1 stub, same as Stripe
   Checkout's own fallback.
5. Once approved and date-active, the campaign is visible to `Matches.tsx`, which builds a
   `Set<propertyId>` of active sponsored campaigns and passes it to
   `interleaveSponsoredProperties`. The landlord's own property page shows real
   impressions/clicks/applications for that campaign (`getCampaignMetrics`), reading
   `ad_impressions`/`ad_clicks` (anonymous counters — no tenant identifier is ever stored on
   these rows) and the property's own `applications` count.

### Perfect Partners™ directory + offers

`perfect_partners` (grouped by `ad_category`) and `partner_offers` are admin-managed only in this
pass — see `PerfectPartnersAdminSection` (`src/pages/admin/PerfectPartnersAdmin.tsx`). A tenant
clicking "Get Offer" calls `redeemPartnerOffer`, which upserts one `offer_redemptions` row per
`(offer_id, tenant_id)` — a repeat click never inflates the lead count — and reveals the promo
code/next step only after that explicit action, never before or automatically. `/partners`
(categories + "Our Advertising Promise" trust copy) and the desktop-only `PartnerOffersSidebar` on
`/search` are the two surfaces; both call `selectPartnerOffers` before rendering anything, so the
frequency ceiling is enforced once, in one place, rather than trusted to each page.

### Compliance by omission

No table in `0006_perfect_partners.sql` has a targeting field for anything other than geography
(`target_city`/`target_state`/`target_zip`/`target_radius_miles`) and `ad_category`. There is
structurally no column to target a protected characteristic with — the Fair Housing safeguard here
is that the field simply doesn't exist, not a runtime check that could be bypassed or forgotten.
Do not add a targeting field to `ad_campaigns` without checking it against the same Fair Housing
checklist that governs Perfect Match™ inputs above.
