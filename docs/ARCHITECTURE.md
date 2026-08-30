# Architecture

## Data layer: two backends, one facade

Every page and component calls into `src/lib/data/api.ts`. It picks one of two implementations
at module load time, based on whether `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set:

- `src/lib/data/localApi.ts` — local dev-mode, backed by `localStore.ts`
  (`localStorage`, seeded from `src/data/seed/`). Zero setup, used when Supabase isn't
  configured.
- `src/lib/data/supabaseApi.ts` — the live Supabase project, using `supabase.auth.*` and
  `supabase.from(...)` against the schema in `supabase/migrations/0001_init.sql`.

Both implementations share their types from `src/lib/data/types.ts` (`AuthUser`,
`PropertyFilter`, `NewProperty`, `ScoredProperty`, `StartCheckout`), which is what lets
`src/pages/` and `src/components/` stay identical regardless of which backend is active — they
only ever import from `api.ts`.

A Supabase project (`the-perfect-tenant`, ref `xbpsuwmmpqltnifmjptb`) is already provisioned
with the migration applied and demo accounts seeded (see the README for credentials). To point
at a *different* project instead, apply `supabase/migrations/0001_init.sql` to it and set the
env vars in `.env.local` (see `.env.example`).

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

## Match scoring

`src/lib/match/score.ts` is intentionally simple and rule-based (Phase 1 scope — no ML). Every
scored input is an objective listing fact: rent-in-range, beds/baths minimums, property type,
search-radius distance (haversine), move-in date, and pet-policy compatibility. Do not add a
scoring input derived from a protected characteristic (familial status, source of income where
prohibited, etc.) — see the Fair Housing checklist in the original build plan.
