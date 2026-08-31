# The Perfect10ant™ — The Verified Rental Network

*"Get verified once. Rent with confidence."* For landlords: *"Stop sorting through applications.
Find verified tenants."*

A two-sided verified rental network, not just another listings site. Tenants build one reusable,
portable **Perfect10ant Passport™** — verification done once, a transparent **Rental Ready**
status, and a rule-based **Perfect Match™** score explaining *why* a property or tenant fits.
Landlords get a **Tenant Marketplace** to discover Rental Ready tenants directly, not just an
application inbox. **Perfect Rent™** lets a landlord offer real, lawful rent incentives (Passport
verification, longer lease, auto-pay, verified rental history) and a tenant see their actual
current quote — never a guess. **Perfect Pay™** turns landlord-confirmed on-time payments into a
real, portable streak/level. **Perfect Rewards™** rolls all of it into one scorecard. **Perfect
Partners™** is the platform's advertising/monetization layer — small, clearly-labeled sponsored
listings and partner offers that never touch a Perfect Match™ score, built to stay "useful,
relevant, never overwhelming" rather than an ad-covered classifieds site.

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
The homepage's "Your Perfect Rent™" hero card is a labeled example calculation (real per-property
numbers are one click away via "See real Perfect Rent™ options →"); the "Perfect Pay™" sidebar
card and the featured-listing Perfect Rent™ badge both link to the real, working features
(`/perfect-pay`, per-property calculator) — nothing on the homepage is a placeholder anymore.

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

- **Perfect10ant Passport™** (`/passport`) — the tenant's reusable profile: Rental Ready
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
  tenants (`/landlord/marketplace`, "Find Your Perfect10ant") — tenants control this via a
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
  MRR), Perfect Rent™/Perfect Pay™ analytics, the editable Perfect Pay™ milestone thresholds, and
  the subscription-plan price editor.
- **Perfect Rent™** (`src/lib/perfectRent/engine.ts`, `RentIncentiveEditor.tsx`,
  `PerfectRentCalculator.tsx`, `PerfectRentBadge.tsx`) — a landlord opts a property into any
  combination of five lawful, non-protected-characteristic incentives (Passport verification,
  longer lease, auto-pay enrollment, verified rental history, an upfront-rent arrangement); the
  tenant always sees Base Rent alongside a real, computed Potential Incentivized Rent on that
  exact listing — never a guaranteed or invented number. Every incentive is gated by a
  `jurisdiction_rules` check first: if it can't safely be offered in that state, the UI shows
  "unavailable in this location" instead of letting the landlord bypass it. Upfront-rent is never
  auto-applied — it always shows as "requires landlord confirmation," and deposit rules are
  deliberately not modeled anywhere (see Compliance notes).
- **Perfect Pay™** (`/perfect-pay`, `computeOnTimeStreak`/`computePerfectPayLevel` in
  `src/types/domain.ts`) — a tenant's on-time-payment streak and level (New → Bronze → Silver →
  Gold → Platinum, thresholds admin-editable, never hard-coded) computed live from
  `payment_verifications` rows a landlord actually confirmed (`landlord/applicants` → "record rent
  payment"). Nothing here is auto-promised: a payment is "verified" only when a landlord (the only
  legitimate source implemented in this pass) has confirmed it.
- **Perfect Rewards™** (`/rewards`) — a scorecard combining Rental Ready status, Perfect Pay
  level, verified rental history, and real (never invented) potential savings from Perfect Rent™,
  plus professional (non-gamified) achievement badges and clearly-labeled "Coming Soon" future
  partner categories (Financial, Insurance, Moving, Home Services, Utilities) with no fake partner
  offers behind them.
- **Perfect Partners™** (`/partners`, `src/lib/perfectPartners/engine.ts`) — the platform's
  advertising/monetization layer, built around one rule enforced structurally, not by convention:
  **paid placement can change visibility, never the Perfect Match™ score.**
  - **Sponsored Property**: a landlord picks an admin-priced package (7-Day Boost/14-Day
    Featured/30-Day Featured/Premium Featured, editable at `/admin`, never hard-coded) from their
    property's edit page ("⭐ Sponsored Property"); the campaign goes to `pending_review` and only
    an admin approval makes it live. A live sponsored property gets promoted to a more prominent
    slot in `/matches`, always labeled "⭐ Sponsored" and always showing its real, unmodified
    match score — `interleaveSponsoredProperties()` only ever repositions an already-scored
    result, it never recomputes or overrides `score`. The landlord sees real impressions/leads/
    applications/spend on their own listing ("Your Property Promotion").
  - **Perfect Partners™ directory** (`/partners`) — admin-managed partner businesses grouped by
    category (Moving, Home Services, Financial/Insurance, Utilities, Home Products, Real Estate),
    each with small "Sponsored"-labeled offer cards (promo code, "Get Offer") and an "Our
    Advertising Promise" trust statement. A narrow, capped Perfect Partners sidebar also appears
    on `/search` for desktop — "useful, relevant, never overwhelming" as an actual admin-editable
    frequency ceiling (`ad_frequency_rules`: max sponsored properties per page, max partner cards
    per page, an ads-enabled kill switch), not just a design intention.
  - **Admin** (`/admin`) — a Campaign Review Queue (approve/reject/pause; nothing goes live
    unreviewed), the package price editor, the Perfect Partners/offer manager, the frequency-rule
    editor, and an Advertising Revenue dashboard (Today/Week/Month/Year/Total) computed from real
    `ad_revenue_events` rows written only when an admin approves a paid campaign — the same
    "never invent a number" pattern as MRR.
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
- `src/lib/perfectRent/engine.ts` — the Perfect Rent™ calculator (`computePerfectRent`): pure,
  data-in/data-out, so the landlord-editor preview, the per-property calculator, and the Rewards
  scorecard all compute identical numbers from the same inputs
- `src/lib/perfectRent/jurisdiction.ts` — `buildJurisdictionAllowed`, the permissive-by-default
  jurisdiction gate (see Compliance notes — this is a real mechanism with no real legal data
  behind it yet)
- `src/lib/perfectPartners/engine.ts` — `interleaveSponsoredProperties` (repositions an
  already-scored result, never rescoring it) and `selectPartnerOffers` (caps partner-offer cards
  per page) — both pure, both reading `ad_frequency_rules` rather than a hard-coded cap
- `src/lib/auth/` — auth context/hooks
- `src/types/domain.ts` — domain types mirrored 1:1 against the SQL schema, plus
  `computeRentalReady` (Rental Ready), `computeOnTimeStreak`/`computePerfectPayLevel` (Perfect
  Pay™) — every one of these is a pure function computed live, never a stored/cached field
- `src/data/seed/` — seed data for local dev-mode (tenants, landlords, properties, invitations,
  interests, shares, reviews, subscription plans, rent incentives, jurisdiction rules, payment
  verifications, Perfect Pay™ milestones, reward events, advertisers, ad packages, ad campaigns,
  Perfect Partners, partner offers, etc.)
- `supabase/migrations/` — canonical SQL schema, applied in numeric order: `0001_init.sql` (core
  Phase 1 schema + RLS), `0002_perfect_tennant_passport.sql` (invitations, interests, sharing,
  reviews, configurable plans, landlord verification), `0003_property_lease_term.sql`,
  `0004_tenant_marketplace_visibility.sql` (marketplace opt-in + the `tenant_public_profile`
  view's current definition), `0005_perfect_rent_pay_rewards.sql` (`rent_incentives`,
  `jurisdiction_rules`, `payment_verifications`, `perfect_pay_milestones`, `reward_events`, plus
  RLS including owner-scoped and admin-read policies), `0006_perfect_partners.sql`
  (`advertisers`, `ad_packages`, `ad_campaigns`, `perfect_partners`, `partner_offers`,
  `offer_redemptions`, `ad_impressions`/`ad_clicks`, `ad_frequency_rules`, `ad_revenue_events`)
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
- **Perfect Rent™ incentives are gated by `jurisdiction_rules`, but that table is a permissive
  stub, not real legal data** — every state defaults to "allowed" until a real row says otherwise
  (currently only NE/`upfront_rent` is seeded as blocked, for demonstration). Do not treat this as
  legal review; a real deployment needs actual jurisdiction-by-jurisdiction rules before this gate
  means anything. See `buildJurisdictionAllowed` in `src/lib/perfectRent/jurisdiction.ts`.
- **No security-deposit or prepaid-rent feature exists anywhere** — deliberately. Deposit limits
  vary by jurisdiction and any such feature needs real legal validation before production use; see
  the comment in `0005_perfect_rent_pay_rewards.sql`. The one exception, `upfront_rent`, is modeled
  only as an incentive *type* that always requires explicit landlord confirmation and is never
  auto-applied to a quoted rent — it is not a deposit/prepaid-rent implementation.
- **Payment verification has exactly one legitimate source in this pass: landlord confirmation**
  (`recordPayment`, from `/landlord/applicants`). The platform does not and cannot independently
  verify a rent payment happened — no payment processor is integrated. A `payment_verifications`
  row is only ever created by an explicit landlord action; nothing marks a payment verified
  automatically.
- **Paid placement (Perfect Partners™/Sponsored Property) cannot change a Perfect Match™ score —
  enforced structurally, not by convention.** `interleaveSponsoredProperties()`
  (`src/lib/perfectPartners/engine.ts`) only ever repositions an entry already scored by the same
  `scoreMatch()` every organic result uses; it has no parameter through which a caller could pass
  a different score. No `ad_campaigns`/`perfect_partners` targeting field is a protected
  characteristic — only geography (city/state/zip/radius) and campaign category exist to target
  on, so there's no field to misuse for discriminatory ad targeting in the first place.
- **No campaign goes live to a tenant unreviewed.** `ad_campaigns` starts in `pending_review`;
  only an admin approval (`reviewCampaign`) makes it `approved`, and the RLS policy tenants read
  through (`ad_campaigns_public_read_active`) only ever returns `approved`, currently date-active
  rows.

## What's deferred (not built in this pass)

- **Live verification providers** (Phase 2) — everything here is placeholder status data.
- **Rich fraud safeguards on reviews** beyond the approved-application gate (e.g. rate limiting,
  dispute handling for a review the landlord contests).
- **Full admin analytics** (charts, churn, geographic growth, verification failure trends) — the
  Admin page ships the underlying metrics and plan editor, not visualizations.
- **QR code passport sharing** — the share-link and per-landlord grant/revoke flows are built;
  rendering an actual QR code image was cut for scope, not because it's hard to add later.
- **"Perfect10ant Protected™"** and other future revenue lines (lease services, rent
  collection, tenant service partnerships) — intentionally not built or implied as existing,
  per the build plan's own instruction not to claim a protection product that doesn't exist yet.
- **Discriminatory-behavior audit tooling** — `audit_logs` exists in the schema but nothing
  writes to it yet.
- **New Tenant Alerts as push/email notifications** — the marketplace surfaces new Rental Ready
  matches on load; there's no background job re-scoring saved searches and pushing alerts yet.
- **Real payment processor integration for Perfect Pay™** — landlord confirmation is the only
  verification source; no bank/rent-collection integration exists, per the payment-data rule
  above.
- **Any security-deposit or prepaid-rent feature** — intentionally not built; needs real legal
  review first (see Compliance notes).
- **Real jurisdiction/compliance data behind the Perfect Rent™ gate** — `jurisdiction_rules` is a
  working mechanism seeded with one demonstration row, not actual state-by-state legal research.
- **Marketplace-wide Perfect Pay™ visibility** — a tenant's payment history is only ever shown to
  themselves and to the specific landlord who recorded it, never broadcast to other landlords
  browsing the Tenant Marketplace (a deliberate privacy/RLS decision, not an oversight).
- **A tenant referral / partner-rewards transaction system** — Perfect Rewards™ ships its
  "Coming Soon" categories as labels only, with no real or fabricated partner offers behind them.
- **Perfect Rent™/Perfect Pay™ analytics visualizations** — the Admin page ships the underlying
  counts (active incentives, average discount, verified-payment tenants, reward events), not
  charts or trends.
- **A separate third-party advertiser signup role/portal** ("Advertise With The Perfect10ant"
  landing page, self-service account creation) — Perfect Partners™ businesses are onboarded by an
  admin in this pass; the only self-service advertising flow built is a landlord promoting their
  own property (`getOrCreateAdvertiserForLandlord` lazily creates the one advertiser row that
  needs).
- **Real advertiser billing** — submitting a Sponsored Property campaign is a Phase 1 stub, same
  pattern as subscription billing: no card is ever charged. An admin's approval still records a
  real `ad_revenue_events` row from the package's real configured price, so the revenue dashboard
  isn't fabricated, but no payment is actually collected yet.
- **Featured Landlord self-serve purchase** — the schema and admin review flow fully support the
  `featured_landlord` campaign type, but the landlord-facing purchase UI was only built for
  Sponsored Property in this pass; a Featured Landlord placement can be created by an admin today.
- **Contextual/behavioral partner-offer targeting** (move-in date, pets, "moving to Omaha" search
  intent) — `selectPartnerOffers()` currently caps and orders by `sort_order` only; geography/
  behavior-based targeting for the Perfect Partners directory itself is not built (Sponsored
  Property campaigns do carry real geography fields, since that's the property's own location).
- **Advertising analytics charts** — the Admin page ships real counts (revenue by period,
  campaign status, redemptions) and a landlord's own per-listing metrics, not visualizations.
- **Perfect Partners categories are a fixed Postgres enum**, not a live admin-editable list —
  adding a wholly new category (beyond the six seeded) needs a migration, consistent with how
  `incentive_type`/`subscription_tier` are already modeled as enums elsewhere in this schema.

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
