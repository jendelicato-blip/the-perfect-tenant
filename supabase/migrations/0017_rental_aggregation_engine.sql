-- Rental Property Aggregation Engine — Phase 1 (admin-only foundation)
--
-- This is a NEW, parallel subsystem — it does not touch `properties`,
-- `applications`, or any other table the existing tenant/landlord marketplace
-- depends on. That's deliberate: the aggregation engine's job is to build a
-- normalized, deduplicated inventory from multiple external sources; nothing
-- here is shown to a tenant yet. Per the product spec this was built against,
-- section 24 is explicit that this ships admin-only first, and public search
-- only gets wired to `agg_properties`/`agg_units` once the admin tooling
-- (source management, duplicate review, data-quality monitoring) is proven
-- out — see docs/ARCHITECTURE.md for the full write-up.
--
-- Legal/compliance stance (spec section 19): every source is registered with
-- an explicit `license_status`, and a source can never be marked `active`
-- while its status is `review_required` or `disabled` (enforced by a CHECK
-- constraint, not just app-level discipline) — see the constraint on
-- rental_sources below. There is no scraper anywhere in this system: the one
-- connector implemented in this phase (`csv_upload`) requires an admin to
-- manually supply data they've already attested they have rights to.

create type rental_source_type as enum (
  'direct_property_manager', 'pms_feed', 'licensed_api', 'user_submitted', 'public_data', 'other'
);

create type data_license_status as enum (
  'authorized', 'licensed', 'partner', 'user_submitted', 'public_data', 'review_required', 'disabled'
);

create table rental_sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  source_type rental_source_type not null,
  license_status data_license_status not null default 'review_required',
  -- Which SourceConnector implementation (src/lib/aggregation/connectors) this
  -- source uses. 'csv_upload' is the only one implemented in this phase; the
  -- interface (see docs) is designed so a real API/feed connector can be
  -- registered here later without any schema change.
  connector_key text not null default 'csv_upload',
  -- Source reliability hierarchy (spec section 6): lower number wins when two
  -- sources disagree on a field. 1=direct property manager ... 5=public data.
  priority_rank int not null default 5,
  sync_interval_minutes int,
  rate_limit_per_hour int,
  contact_name text,
  contact_email text,
  notes text,
  active boolean not null default false,
  last_synced_at timestamptz,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_sources_no_active_unreviewed check (
    not (active and license_status in ('review_required', 'disabled'))
  )
);

create table rental_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references rental_sources (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  properties_seen int not null default 0,
  properties_created int not null default 0,
  properties_updated int not null default 0,
  units_seen int not null default 0,
  units_created int not null default 0,
  units_updated int not null default 0,
  duplicate_candidates_created int not null default 0,
  errors_count int not null default 0,
  error_log jsonb not null default '[]'::jsonb,
  triggered_by uuid references users (id),
  created_at timestamptz not null default now()
);

create type agg_property_type as enum (
  'apartment_community', 'apartment', 'condo', 'townhome', 'single_family',
  'duplex', 'multifamily', 'student_housing', 'other'
);

create type agg_verification_status as enum ('unverified', 'needs_verification', 'verified');

-- The canonical property record (spec section 5: "CANONICAL PROPERTY"). One
-- row here can be backed by many rows in agg_property_sources — e.g. the same
-- physical building supplied by three different sources with slightly
-- different names/addresses.
create table agg_properties (
  id uuid primary key default uuid_generate_v4(),
  property_name text not null,
  property_type agg_property_type not null default 'other',
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  county text,
  latitude double precision,
  longitude double precision,
  neighborhood text,
  description text,
  year_built int,
  total_units int,
  amenities jsonb not null default '[]'::jsonb,
  pet_policy jsonb not null default '{}'::jsonb,
  parking text,
  utilities jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  website text,
  management_company text,
  management_contact jsonb not null default '{}'::jsonb,
  -- Which source's data currently "wins" on this canonical record when
  -- sources disagree (spec section 6) — always the active source with the
  -- best priority_rank among this property's linked sources.
  primary_source_id uuid references rental_sources (id),
  verification_status agg_verification_status not null default 'unverified',
  trust_score int not null default 100 check (trust_score between 0 and 100),
  quality_flags jsonb not null default '[]'::jsonb,
  last_verified timestamptz,
  last_seen timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provenance (spec section 15): every canonical property may be backed by
-- multiple source records. Nothing here is ever deleted when a duplicate is
-- found — see agg_duplicate_candidates below.
create table agg_property_sources (
  id uuid primary key default uuid_generate_v4(),
  agg_property_id uuid not null references agg_properties (id) on delete cascade,
  source_id uuid not null references rental_sources (id) on delete cascade,
  source_property_id text not null,
  source_url text,
  -- The untouched normalized record as this source reported it, before it was
  -- merged into the canonical row — lets an admin see exactly what a source
  -- said vs. what won out canonically.
  raw_data jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_verified timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_property_id)
);

create type agg_availability_status as enum (
  'available', 'available_soon', 'contact_for_availability', 'application_pending',
  'rented', 'leased', 'unavailable', 'expired', 'needs_verification'
);

-- A property may have hundreds of units and only a handful currently
-- available (spec section 8) — that distinction lives entirely here, never
-- inferred from the property row.
create table agg_units (
  id uuid primary key default uuid_generate_v4(),
  agg_property_id uuid not null references agg_properties (id) on delete cascade,
  unit_number text,
  floor int,
  bedrooms numeric(3, 1),
  bathrooms numeric(3, 1),
  square_feet int,
  monthly_rent_cents int,
  rent_min_cents int,
  rent_max_cents int,
  deposit_cents int,
  available_date date,
  lease_term text,
  furnished boolean not null default false,
  pets_allowed jsonb not null default '{}'::jsonb,
  parking text,
  utilities jsonb not null default '[]'::jsonb,
  unit_amenities jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  availability_status agg_availability_status not null default 'needs_verification',
  primary_source_id uuid references rental_sources (id),
  trust_score int not null default 100 check (trust_score between 0 and 100),
  quality_flags jsonb not null default '[]'::jsonb,
  last_seen timestamptz not null default now(),
  last_verified timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agg_unit_sources (
  id uuid primary key default uuid_generate_v4(),
  agg_unit_id uuid not null references agg_units (id) on delete cascade,
  source_id uuid not null references rental_sources (id) on delete cascade,
  source_unit_id text not null,
  source_url text,
  raw_data jsonb not null default '{}'::jsonb,
  is_primary boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_verified timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_unit_id)
);

-- Duplicate review queue (spec sections 5 & 13): the matching engine only
-- ever proposes a match here — it never merges automatically, regardless of
-- confidence. An admin must explicitly merge, keep separate, or ignore.
create table agg_duplicate_candidates (
  id uuid primary key default uuid_generate_v4(),
  property_a_id uuid not null references agg_properties (id) on delete cascade,
  property_b_id uuid not null references agg_properties (id) on delete cascade,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  match_reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'merged', 'kept_separate', 'ignored')),
  reviewed_by uuid references users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agg_duplicate_candidates_distinct check (property_a_id <> property_b_id)
);

-- Singleton admin-configurable thresholds (spec section 7), same pattern as
-- platform_fee_config (0007) / verified_tier_config (0011).
create table agg_freshness_config (
  id text primary key default 'default',
  needs_verification_days int not null default 7,
  reduced_ranking_days int not null default 14,
  auto_inactive_days int not null default 30,
  duplicate_match_threshold numeric(4, 3) not null default 0.720,
  updated_at timestamptz not null default now()
);
insert into agg_freshness_config (id) values ('default');

-- ---------- Indexes (spec section 22: geo + filter search at scale) ----------

create index idx_agg_properties_zip on agg_properties (zip);
create index idx_agg_properties_city on agg_properties (city);
create index idx_agg_properties_state on agg_properties (state);
create index idx_agg_properties_county on agg_properties (county);
create index idx_agg_properties_geo on agg_properties (latitude, longitude);
create index idx_agg_properties_verification on agg_properties (verification_status);
create index idx_agg_properties_active on agg_properties (active);
create index idx_agg_properties_updated_at on agg_properties (updated_at);
create index idx_agg_properties_last_seen on agg_properties (last_seen);
create index idx_agg_property_sources_property on agg_property_sources (agg_property_id);
create index idx_agg_property_sources_source on agg_property_sources (source_id);
create index idx_agg_units_property on agg_units (agg_property_id);
create index idx_agg_units_rent on agg_units (monthly_rent_cents);
create index idx_agg_units_bedrooms on agg_units (bedrooms);
create index idx_agg_units_bathrooms on agg_units (bathrooms);
create index idx_agg_units_availability on agg_units (availability_status);
create index idx_agg_units_updated_at on agg_units (updated_at);
create index idx_agg_unit_sources_unit on agg_unit_sources (agg_unit_id);
create index idx_agg_unit_sources_source on agg_unit_sources (source_id);
create index idx_rental_sync_runs_source on rental_sync_runs (source_id);
create index idx_agg_duplicate_candidates_status on agg_duplicate_candidates (status);

-- ---------- RLS: admin-only for Phase 1 ----------
-- Nothing here is public yet — see the file header. Every table gets a single
-- admin-gated ALL policy (no separate read policy to merge later, avoiding
-- the multiple-permissive-policies pattern fixed elsewhere in this project).

alter table rental_sources enable row level security;
alter table rental_sync_runs enable row level security;
alter table agg_properties enable row level security;
alter table agg_property_sources enable row level security;
alter table agg_units enable row level security;
alter table agg_unit_sources enable row level security;
alter table agg_duplicate_candidates enable row level security;
alter table agg_freshness_config enable row level security;

create policy "rental_sources_admin_all" on rental_sources for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "rental_sync_runs_admin_all" on rental_sync_runs for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_properties_admin_all" on agg_properties for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_property_sources_admin_all" on agg_property_sources for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_units_admin_all" on agg_units for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_unit_sources_admin_all" on agg_unit_sources for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_duplicate_candidates_admin_all" on agg_duplicate_candidates for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));

create policy "agg_freshness_config_admin_all" on agg_freshness_config for all
  using (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin))
  with check (exists (select 1 from users u where u.id = (select auth.uid()) and u.is_admin));
