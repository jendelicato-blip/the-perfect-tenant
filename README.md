# The Perfect Tenant

A rental marketplace that matches tenants to landlords with a rule-based, explainable match
score — "why it matches," not a black box — plus tenant onboarding, property listing
management, saved items, an application pipeline, in-app messaging, and landlord subscription
tiers.

This is the **Phase 1 (core marketplace)** build: manual/placeholder verification statuses only
— no live identity/credit/background provider is wired up yet (see Phase 2 in the original
build plan).

## Stack

React + TypeScript + Vite + Tailwind CSS + React Router. Data layer designed 1:1 against a
Postgres schema (`supabase/migrations/0001_init.sql`) so it can move from local dev-mode data to
a live Supabase project with no UI changes — see `docs/ARCHITECTURE.md`.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. **No setup is required to try the app** — it runs in local dev-mode
against browser `localStorage`, seeded with demo tenant and landlord accounts (see the login
page for one-click demo logins, password `password123` for all of them).

### Connecting the live Supabase project

A Supabase project (`the-perfect-tenant`, ref `xbpsuwmmpqltnifmjptb`) already exists with
`supabase/migrations/0001_init.sql` applied and the same demo accounts seeded (password
`password123` — auth is real here, not `localStorage`). To point the app at it, copy
`.env.example` to `.env.local` and fill in the URL/anon key from the Supabase dashboard
(Project Settings → API) — both are safe to use client-side; Row Level Security is what
actually restricts access, not the key itself.

To use a different Supabase project instead, apply `supabase/migrations/0001_init.sql` to it
first. See `docs/ARCHITECTURE.md` for what wiring the data layer to a live project involves.

### Stripe billing (optional)

Two Edge Functions are deployed to the live project: `stripe-checkout` (creates a Checkout
session for a chosen tier) and `stripe-webhook` (updates `subscriptions` on payment/renewal/
cancellation). To make the "Choose plan" button do a real Stripe Checkout instead of updating
the tier directly:

1. In your Stripe dashboard (test mode), create 3 products/prices for Starter/Growth/Portfolio.
2. Set these secrets on the Supabase project (`supabase secrets set NAME=value`, or via the
   dashboard under Edge Functions → Secrets):
   `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PORTFOLIO`,
   `PUBLIC_SITE_URL` (your deployed app's URL, for the post-checkout redirect).
3. In Stripe, add a webhook endpoint pointing at the `stripe-webhook` function's URL, listening
   for `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; set its signing secret as `STRIPE_WEBHOOK_SECRET`.

Until those secrets are set, `stripe-checkout` returns an error and the Pricing page falls back
to the Phase 1 stub automatically.

## Project layout

- `src/pages/` — routed pages: landing, auth, tenant flow (`tenant/`), landlord flow
  (`landlord/`), messaging
- `src/components/` — shared UI primitives (`ui/`) and feature components
- `src/lib/data/` — data-access layer: `api.ts` (the facade every page calls, picks a backend),
  `localApi.ts` (local dev-mode logic) + `localStore.ts` (its `localStorage` persistence),
  `supabaseApi.ts` (live Supabase logic) + `supabaseClient.ts`, `types.ts` (shared types)
- `src/lib/match/score.ts` — the rule-based match scoring engine (Fair-Housing-safe: scores
  only objective listing facts, never protected characteristics)
- `src/lib/auth/` — auth context/hooks
- `src/types/domain.ts` — domain types mirrored 1:1 against the SQL schema
- `src/data/seed/` — seed data for local dev-mode (tenants, landlords, properties, etc.)
- `supabase/migrations/` — canonical SQL schema, including Row Level Security policies and the
  `tenant_public_profile` view landlords query instead of raw verification tables
- `supabase/functions/` — `stripe-checkout` and `stripe-webhook` Edge Functions (deployed to the
  live project already; see "Stripe billing" below to activate them)

## Compliance notes (Phase 1 scope)

- Match scoring and search filters use only objective listing facts (rent, beds/baths, location
  radius, move-in date, pet policy) — see the Fair Housing checklist in the original build plan
  before adding any new filter or scoring input.
- Landlords never get direct access to tenant verification base tables
  (`identity_verification`, `credit_screenings`, etc.) — only the `tenant_public_profile` view,
  which exposes verification *status* and only for tenants who applied to one of their
  properties or were explicitly saved.
- FCRA adverse-action process, state-specific screening law review, and a real attorney's review
  of Terms/Privacy/Screening Disclosure are still outstanding — required before Phase 2 (live
  verification providers) goes live, not before.

## What's stubbed vs. real in this Phase 1 build

- **Auth, tenant/landlord data, matching, messaging, applications, saved items**: fully
  functional against both local dev-mode and the live Supabase project (`src/lib/data/api.ts`
  picks the backend automatically based on whether `VITE_SUPABASE_URL` is set).
- **Verification statuses**: placeholder data only — no live provider integration (Phase 2).
- **Stripe billing**: real Checkout session creation and webhook handling are deployed
  (`supabase/functions/stripe-checkout`, `supabase/functions/stripe-webhook`); they just need
  Stripe secrets set (see above) to go live — until then the Pricing page falls back to updating
  the tier directly.

## Known security-advisory items (Supabase linter)

Running `get_advisors` against the live project flags two items worth knowing about rather than
silently ignoring:

- **`tenant_public_profile` is flagged as a "Security Definer View."** This is intentional, not
  an oversight — see the comment above the view in `0001_init.sql`. It uses
  `security_invoker = false` deliberately, with its own `WHERE` clause (not RLS re-inheritance)
  enforcing that a landlord only sees a tenant_id if that tenant applied to one of their
  properties or was saved. Supabase's linter can't distinguish this from an actually-leaky view,
  so it flags both the same way — treat this one as reviewed, not as a bug to "fix" by flipping
  `security_invoker` to `true` (that would silently break the view for landlords instead, since
  the base verification tables' RLS is owner-only).
- **`spatial_ref_sys` (a PostGIS system table of spatial reference IDs) has RLS disabled.** This
  is a stock PostGIS table with no tenant/user data in it — Supabase flags any public table
  without RLS as critical regardless of sensitivity. Enabling RLS on it with no policies would
  block PostGIS's own internal lookups; leaving it as-is is the standard, low-risk choice for a
  project using PostGIS. Revisit only if a stricter tenant-per-project audit requires it.
