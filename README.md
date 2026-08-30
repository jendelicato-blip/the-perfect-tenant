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

To connect a real Supabase project instead, copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

then apply `supabase/migrations/0001_init.sql` to that project. See `docs/ARCHITECTURE.md` for
what wiring the data layer to a live project involves.

## Project layout

- `src/pages/` — routed pages: landing, auth, tenant flow (`tenant/`), landlord flow
  (`landlord/`), messaging
- `src/components/` — shared UI primitives (`ui/`) and feature components
- `src/lib/data/` — data-access layer: `api.ts` (the facade every page calls),
  `localStore.ts` (the local dev-mode store), `supabaseClient.ts`
- `src/lib/match/score.ts` — the rule-based match scoring engine (Fair-Housing-safe: scores
  only objective listing facts, never protected characteristics)
- `src/lib/auth/` — auth context/hooks
- `src/types/domain.ts` — domain types mirrored 1:1 against the SQL schema
- `src/data/seed/` — seed data for local dev-mode (tenants, landlords, properties, etc.)
- `supabase/migrations/` — canonical SQL schema, including Row Level Security policies and the
  `tenant_public_profile` view landlords query instead of raw verification tables

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
  functional against the local dev-mode store; ready to be pointed at Supabase using the same
  schema.
- **Verification statuses**: placeholder data only — no live provider integration (Phase 2).
- **Stripe billing**: tier selection UI and a `subscriptions` table wired up; no real Stripe
  Checkout session or webhook yet — selecting a tier updates the record directly for testing.
