# The Perfect Tennant™ — The Verified Rental Network

*"Get verified once. Rent with confidence."* For landlords: *"Stop sorting through applications.
Find verified tenants."*

A two-sided verified rental network, not just another listings site. Tenants build one reusable,
portable **Perfect Tennant Passport™** — verification done once, a transparent **Rental Ready**
status, and a rule-based **Perfect Match™** score explaining *why* a property or tenant fits.
Landlords get a **Tenant Marketplace** to discover Rental Ready tenants directly, not just an
application inbox.

This is a **Phase 1 (core marketplace)** build: manual/placeholder verification statuses only —
no live identity/credit/background provider is wired up yet (see Phase 2 in the original build
plan). Nothing here claims a verification happened unless the corresponding status is actually
`verified`.

## Stack

React + TypeScript + Vite + Tailwind CSS + React Router. Data layer designed 1:1 against a
Postgres schema (`supabase/migrations/`) so it can move from local dev-mode data to a live
Supabase project with no UI changes — see `docs/ARCHITECTURE.md`.

**Visual design**: a green/navy palette (`tailwind.config.js` — `brand`/`ink`) with Fraunces
(serif, headings) + Inter (sans, body), loaded via Google Fonts in `index.html`. Logged-out
visitors get `MarketingNavbar.tsx` (mega-menu style: For Tenants/For Landlords dropdowns,
Pricing, About Us); authenticated users get the functional in-app `Navbar.tsx`, same palette.
The homepage's "Your Perfect Rent™" and "Perfect Pay™" cards are intentionally illustrative
only — marked "Illustrative example" / "Coming soon" — no rent-discount or payment-rewards logic
exists behind them; don't wire real numbers into them without designing that feature properly
first (new schema, real payment data, etc.).

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. **No setup is required to try the app** — it runs in local dev-mode
against browser `localStorage`, seeded with demo tenant and landlord accounts (see the login
page for one-click demo logins, password `password123` for all of them). Amara (tenant) is fully
Rental Ready; Devon (tenant) is Almost Ready, to show what an incomplete Passport looks like.
Priya (landlord) doubles as the demo admin account (see `/admin`).

### Connecting the live Supabase project

A Supabase project (`the-perfect-tenant`, ref `xbpsuwmmpqltnifmjptb`) already exists with every
migration in `supabase/migrations/` applied and the same demo accounts/data seeded (password
`password123` — auth is real here, not `localStorage`). To point the app at it, copy
`.env.example` to `.env.local` and fill in the URL/anon key from the Supabase dashboard (Project
Settings → API) — both are safe to use client-side; Row Level Security is what actually
restricts access, not the key itself.

To use a different Supabase project instead, apply every file in `supabase/migrations/` to it,
in order.

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
to the Phase 1 stub automatically. Pricing itself is never hard-coded — it's read from the
`subscription_plans` table, editable at `/admin` by an account with `users.is_admin = true`.

## What's built

- **Perfect Tennant Passport™** (`/passport`) — the tenant's reusable profile: Rental Ready
  status, verification summary, rental preferences, share/revoke access (secure link or a
  specific landlord), a "Recent Passport Activity" view log, and a milestone timeline.
- **Rental Ready status** (🟢/🟡/🔴, `computeRentalReady` in `src/types/domain.ts`) — always
  derived live from the 8 verification categories, never a stored/cached field, so it can't
  drift from the underlying data. Tells the tenant exactly what's missing.
- **Verification Center** (`/verification`) — every category's status, date verified, expiration,
  provider, with "✓ Third-Party Verified" labeling. No black-box score — ever.
- **Perfect Match™** (`src/lib/match/score.ts`) — rule-based, transparent, weighted across rent,
  beds/baths, location radius, move-in date, lease length, pet policy, parking, and amenities.
  Every reason shown is one of those objective facts, matched or not — never a protected
  characteristic.
- **Two-sided marketplace**: tenants search properties (`/search`, `/matches`); landlords search
  tenants (`/landlord/marketplace`, "Find Your Perfect Tennant") — tenants control this via a
  `passport_visibility` setting (marketplace / applied-or-saved-only / private).
- **Invite to Apply** (landlord → tenant) and **"I'm Interested"** (tenant → landlord) — two
  distinct signals, both surfaced as notifications and in dedicated inboxes
  (`/invitations` for tenants, `/landlord/interests` for landlords).
- **Landlord verification** (identity/contact/business flags) and a **"✓ Verified Landlord"**
  badge shown on listings.
- **Landlord reviews** — a tenant can rate a landlord (communication, maintenance, accuracy,
  professionalism, move-in experience) only after an *approved* application with them, as a
  guard against retaliatory/fraudulent reviews.
- **Notifications** — a bell dropdown (`src/components/NotificationBell.tsx`) reading real
  `notifications` rows generated by invitations, interest, and application status changes.
- **Admin dashboard** (`/admin`, gated by `users.is_admin`) — key platform metrics (tenants,
  Rental Ready count, landlords, verified landlords, properties, applications, Passport shares,
  MRR) and the subscription-plan price editor.
- Everything from the Phase 1 base build: auth, onboarding, property CRUD, application pipeline,
  messaging, saved items, Stripe Checkout.

## Project layout

- `src/pages/` — routed pages: landing + `/for-landlords`, auth, tenant flow (`tenant/`),
  landlord flow (`landlord/`), `admin/`, messaging
- `src/components/` — shared UI primitives (`ui/`), `NotificationBell`, feature components
- `src/lib/data/` — data-access layer: `api.ts` (the facade every page calls, picks a backend),
  `localApi.ts` (local dev-mode logic) + `localStore.ts` (its `localStorage` persistence),
  `supabaseApi.ts` (live Supabase logic) + `supabaseClient.ts`, `types.ts` (shared types)
- `src/lib/match/score.ts` — the Perfect Match™ engine (Fair-Housing-safe: scores only objective
  listing facts, never protected characteristics)
- `src/lib/auth/` — auth context/hooks
- `src/types/domain.ts` — domain types mirrored 1:1 against the SQL schema, plus
  `computeRentalReady` (the single source of truth for Rental Ready status)
- `src/data/seed/` — seed data for local dev-mode (tenants, landlords, properties, invitations,
  interests, shares, reviews, subscription plans, etc.)
- `supabase/migrations/` — canonical SQL schema, applied in numeric order: `0001_init.sql` (core
  Phase 1 schema + RLS), `0002_perfect_tennant_passport.sql` (invitations, interests, sharing,
  reviews, configurable plans, landlord verification), `0003_property_lease_term.sql`,
  `0004_tenant_marketplace_visibility.sql` (marketplace opt-in + the `tenant_public_profile`
  view's current definition)
- `supabase/functions/` — `stripe-checkout` and `stripe-webhook` Edge Functions (deployed to the
  live project already; see "Stripe billing" above to activate them)

## Compliance notes (Phase 1 scope)

- Perfect Match™ and search filters use only objective, lawful rental criteria (rent, beds/baths,
  location radius, move-in date, lease length, pet policy, parking, amenities) — see the Fair
  Housing checklist in the original build plan before adding any new filter or scoring input.
  Never derive a match input from a protected characteristic.
- Landlords never get direct access to tenant verification base tables
  (`identity_verification`, `credit_screenings`, etc.) — only the `tenant_public_profile` view,
  which exposes verification *status* and only for tenants who opted into the marketplace, or
  who applied to/were saved by that landlord (tenant-controlled via `passport_visibility`).
- Landlord reviews require an approved application as a basic anti-retaliation/anti-fraud guard
  — see the note in `0002_perfect_tennant_passport.sql`. Not a complete fraud-safeguard system;
  revisit before this is a real trust signal at scale.
- FCRA adverse-action process, state-specific screening law review, a real attorney's review of
  Terms/Privacy/Screening Disclosure, and a proper discriminatory-behavior audit-log system
  (beyond the existing `audit_logs` table, which nothing writes to yet) are still outstanding.

## What's deferred (not built in this pass)

- **Live verification providers** (Phase 2) — everything here is placeholder status data.
- **Rich fraud safeguards on reviews** beyond the approved-application gate (e.g. rate limiting,
  dispute handling for a review the landlord contests).
- **Full admin analytics** (charts, churn, geographic growth, verification failure trends) — the
  Admin page ships the underlying metrics and plan editor, not visualizations.
- **QR code passport sharing** — the share-link and per-landlord grant/revoke flows are built;
  rendering an actual QR code image was cut for scope, not because it's hard to add later.
- **"Perfect Tennant Protected™"** and other future revenue lines (lease services, rent
  collection, tenant service partnerships) — intentionally not built or implied as existing,
  per the build plan's own instruction not to claim a protection product that doesn't exist yet.
- **Discriminatory-behavior audit tooling** — `audit_logs` exists in the schema but nothing
  writes to it yet.
- **New Tenant Alerts as push/email notifications** — the marketplace surfaces new Rental Ready
  matches on load; there's no background job re-scoring saved searches and pushing alerts yet.

## Known security-advisory items (Supabase linter)

Running `get_advisors` against the live project surfaces a few items worth knowing about rather
than silently ignoring:

- **`tenant_public_profile` is flagged as a "Security Definer View."** This is intentional, not
  an oversight — see the comment above the view in `0004_tenant_marketplace_visibility.sql`. It
  uses `security_invoker = false` deliberately, with its own `WHERE` clause (not RLS
  re-inheritance) enforcing that a landlord only sees a tenant_id if that tenant opted into the
  marketplace, applied to one of their properties, or was saved. Supabase's linter can't
  distinguish this from an actually-leaky view, so it flags both the same way — treat this one
  as reviewed, not as a bug to "fix" by flipping `security_invoker` to `true` (that would
  silently break the view for landlords instead, since the base verification tables' RLS is
  owner-only).
- **`spatial_ref_sys` (a PostGIS system table of spatial reference IDs) has RLS disabled.** This
  is a stock PostGIS table with no tenant/user data in it — Supabase flags any public table
  without RLS as critical regardless of sensitivity. Enabling RLS on it with no policies would
  block PostGIS's own internal lookups; leaving it as-is is the standard, low-risk choice for a
  project using PostGIS.
- **Leaked-password protection is disabled** on the Supabase Auth instance (a project default,
  not something this build controls via SQL/migrations). Worth turning on before real users sign
  up: Supabase dashboard → Authentication → Policies → enable "leaked password protection."
