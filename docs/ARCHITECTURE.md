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
