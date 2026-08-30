# Architecture

## Data layer: local dev-mode now, Supabase-ready by design

Every page and component calls into `src/lib/data/api.ts`. That module's function signatures
and return types are shaped 1:1 against `src/types/domain.ts`, which is itself shaped 1:1
against `supabase/migrations/0001_init.sql`. Today, every function in `api.ts` reads and writes
`src/lib/data/localStore.ts` — an in-memory store persisted to `localStorage`, seeded from
`src/data/seed/`.

To connect a live Supabase project:

1. Apply `supabase/migrations/0001_init.sql` to the project (creates tables, enums, RLS
   policies, and the `tenant_public_profile` view).
2. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
3. Replace each function body in `api.ts` with the equivalent `supabase.from(...)` /
   `supabase.auth.*` call. No changes are needed in `src/pages/` or `src/components/` — they
   only depend on `api.ts`'s exported types and function signatures.
4. Auth: swap `signUp`/`signIn`/`signOut`/`getCurrentUser` to `supabase.auth.signUp`,
   `signInWithPassword`, `signOut`, and `getSession`, then upsert the corresponding row into
   `users` (and `tenants`/`landlords`) on first sign-in.

This mirrors the same swap-ready pattern used in the reference Supabase build this project was
scaffolded from (seed JSON → live Postgres with no UI changes).

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

## Match scoring

`src/lib/match/score.ts` is intentionally simple and rule-based (Phase 1 scope — no ML). Every
scored input is an objective listing fact: rent-in-range, beds/baths minimums, property type,
search-radius distance (haversine), move-in date, and pet-policy compatibility. Do not add a
scoring input derived from a protected characteristic (familial status, source of income where
prohibited, etc.) — see the Fair Housing checklist in the original build plan.
