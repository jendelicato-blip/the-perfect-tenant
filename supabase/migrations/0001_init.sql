-- The Perfect Tenant — Phase 1 core schema
--
-- This mirrors src/types/domain.ts and the local dev-mode store 1:1, so once
-- a Supabase project is connected the data-access layer in src/lib/data/api.ts
-- can be pointed at these tables with no changes to pages/components.
--
-- Compliance note: Row Level Security is the primary control keeping landlords
-- from ever querying raw tenant PII (SSNs, credit reports, background checks).
-- Landlord-facing reads MUST go through the `tenant_public_profile` view below,
-- never the base verification tables directly.

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ---------- Enums ----------

create type user_role as enum ('tenant', 'landlord');
create type verification_status as enum ('not_started', 'pending', 'verified', 'failed', 'expired');
create type property_type as enum ('apartment', 'house', 'condo', 'townhouse', 'studio');
create type pet_policy as enum ('no_pets', 'cats_only', 'dogs_only', 'cats_and_dogs', 'case_by_case');
create type property_status as enum ('draft', 'active', 'paused', 'leased');
create type application_status as enum ('submitted', 'reviewing', 'approved', 'declined', 'withdrawn');
create type subscription_tier as enum ('starter', 'growth', 'portfolio');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');
create type dispute_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- ---------- Identity ----------

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role user_role not null,
  phone text,
  created_at timestamptz not null default now()
);

create table tenants (
  user_id uuid primary key references users (id) on delete cascade,
  intro_text text,
  photo_url text,
  household_size int not null default 1,
  lease_pref_months int
);

create table tenant_preferences (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  min_rent numeric(10, 2) not null default 0,
  max_rent numeric(10, 2) not null default 0,
  beds int not null default 0,
  baths numeric(3, 1) not null default 0,
  property_types property_type[] not null default '{}',
  move_in_date date not null,
  pets boolean not null default false
);

create table tenant_areas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  city text not null,
  zip text not null,
  lat double precision not null,
  lng double precision not null,
  radius_miles numeric(5, 1) not null default 10,
  geog geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) stored
);
create index tenant_areas_geog_idx on tenant_areas using gist (geog);

create table tenant_pets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  type text not null,
  breed text,
  weight numeric(5, 1)
);

-- ---------- Verification (sensitive — RLS locks these to owner + service role only) ----------

create table employment (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  employer text,
  title text,
  status verification_status not null default 'not_started',
  provider text,
  verified_at timestamptz,
  expires_at timestamptz
);
create index employment_status_idx on employment (tenant_id, status, expires_at);

create table income_verification (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  monthly_income_range text,
  status verification_status not null default 'not_started',
  provider text,
  verified_at timestamptz,
  expires_at timestamptz
);
create index income_verification_status_idx on income_verification (tenant_id, status, expires_at);

create table identity_verification (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  status verification_status not null default 'not_started',
  provider text,
  verified_at timestamptz,
  expires_at timestamptz
);
create index identity_verification_status_idx on identity_verification (tenant_id, status, expires_at);

create table rental_history (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  prior_address text not null,
  landlord_contact text,
  status verification_status not null default 'not_started',
  verified_at timestamptz
);

create table tenant_references (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  name text not null,
  relationship text not null,
  contact text,
  status verification_status not null default 'not_started'
);

create table credit_screenings (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  status verification_status not null default 'not_started',
  provider text,
  report_ref text,
  completed_at timestamptz,
  expires_at timestamptz
);
create index credit_screenings_status_idx on credit_screenings (tenant_id, status, expires_at);

create table background_screenings (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  status verification_status not null default 'not_started',
  provider text,
  report_ref text,
  completed_at timestamptz
);
create index background_screenings_status_idx on background_screenings (tenant_id, status);

create table eviction_screenings (
  tenant_id uuid primary key references tenants (user_id) on delete cascade,
  status verification_status not null default 'not_started',
  provider text,
  completed_at timestamptz
);
create index eviction_screenings_status_idx on eviction_screenings (tenant_id, status);

-- ---------- Landlords & properties ----------

create table landlords (
  user_id uuid primary key references users (id) on delete cascade,
  company_name text,
  subscription_tier subscription_tier not null default 'starter'
);

create table properties (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  lat double precision not null,
  lng double precision not null,
  geog geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) stored,
  rent numeric(10, 2) not null,
  deposit numeric(10, 2) not null,
  beds int not null,
  baths numeric(3, 1) not null,
  sqft int,
  type property_type not null,
  available_date date not null,
  pet_policy pet_policy not null default 'no_pets',
  amenities text[] not null default '{}',
  description text not null default '',
  status property_status not null default 'draft',
  created_at timestamptz not null default now()
);
create index properties_geog_idx on properties using gist (geog);
create index properties_status_idx on properties (status);

create table property_photos (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties (id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

-- ---------- Matching, applications, messaging ----------

create table tenant_matches (
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  score int not null,
  reasons_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (tenant_id, property_id)
);

create table applications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  status application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, property_id)
);

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id uuid not null references users (id) on delete cascade,
  body text not null,
  attachment_url text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table saved_properties (
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, property_id)
);

create table saved_tenants (
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (landlord_id, tenant_id)
);

-- ---------- Billing, notifications, audit, disputes ----------

create table subscriptions (
  landlord_id uuid primary key references landlords (user_id) on delete cascade,
  tier subscription_tier not null default 'starter',
  stripe_customer_id text,
  status subscription_status not null default 'trialing',
  renews_at timestamptz
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references users (id) on delete cascade,
  subject_id uuid not null references users (id) on delete cascade,
  reason text not null,
  status dispute_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ---------- Safe views ----------
-- Landlords are granted access to these views ONLY, never the base
-- verification tables (employment, income_verification, identity_verification,
-- credit_screenings, background_screenings, eviction_screenings, rental_history,
-- tenant_references). The base tables carry report_ref / provider identifiers
-- that must stay restricted to the tenant themselves and a service role.

-- security_barrier + an explicit authorization predicate (rather than relying
-- on security_invoker to re-apply the owner-only RLS policies on the base
-- verification tables, which would make this view return nothing for
-- landlords) is what makes this view safe: a landlord can only ever see a
-- tenant_id here if that tenant applied to one of their properties or the
-- landlord saved them, and the view exposes verification *status* only —
-- never provider, report_ref, or any other column from the base tables.
create view tenant_public_profile
with (security_barrier = true, security_invoker = false) as
select
  t.user_id as tenant_id,
  u.email,
  t.intro_text,
  t.photo_url,
  t.household_size,
  t.lease_pref_months,
  p.min_rent,
  p.max_rent,
  p.beds,
  p.baths,
  p.property_types,
  p.move_in_date,
  p.pets,
  coalesce(iv.status, 'not_started') as identity_status,
  coalesce(inc.status, 'not_started') as income_status,
  coalesce(cs.status, 'not_started') as credit_status,
  coalesce(bs.status, 'not_started') as background_status,
  coalesce(es.status, 'not_started') as eviction_status
from tenants t
join users u on u.id = t.user_id
left join tenant_preferences p on p.tenant_id = t.user_id
left join identity_verification iv on iv.tenant_id = t.user_id
left join income_verification inc on inc.tenant_id = t.user_id
left join credit_screenings cs on cs.tenant_id = t.user_id
left join background_screenings bs on bs.tenant_id = t.user_id
left join eviction_screenings es on es.tenant_id = t.user_id
where
  t.user_id = auth.uid()
  or exists (
    select 1
    from applications a
    join properties pr on pr.id = a.property_id
    where a.tenant_id = t.user_id and pr.landlord_id = auth.uid()
  )
  or exists (
    select 1 from saved_tenants st
    where st.tenant_id = t.user_id and st.landlord_id = auth.uid()
  );

-- ---------- Row Level Security ----------

alter table users enable row level security;
alter table tenants enable row level security;
alter table tenant_preferences enable row level security;
alter table tenant_areas enable row level security;
alter table tenant_pets enable row level security;
alter table employment enable row level security;
alter table income_verification enable row level security;
alter table identity_verification enable row level security;
alter table rental_history enable row level security;
alter table tenant_references enable row level security;
alter table credit_screenings enable row level security;
alter table background_screenings enable row level security;
alter table eviction_screenings enable row level security;
alter table landlords enable row level security;
alter table properties enable row level security;
alter table property_photos enable row level security;
alter table tenant_matches enable row level security;
alter table applications enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table saved_properties enable row level security;
alter table saved_tenants enable row level security;
alter table subscriptions enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table disputes enable row level security;

-- users: read your own row
create policy users_select_self on users for select using (id = auth.uid());
create policy users_update_self on users for update using (id = auth.uid());

-- tenants + preferences + areas + pets: owner full access
create policy tenants_owner_all on tenants for all using (user_id = auth.uid());
create policy tenant_preferences_owner_all on tenant_preferences for all using (tenant_id = auth.uid());
create policy tenant_areas_owner_all on tenant_areas for all using (tenant_id = auth.uid());
create policy tenant_pets_owner_all on tenant_pets for all using (tenant_id = auth.uid());

-- verification tables: owner (tenant) read/write only — landlords must use
-- the tenant_public_profile view instead, never these tables directly.
create policy employment_owner_all on employment for all using (tenant_id = auth.uid());
create policy income_verification_owner_all on income_verification for all using (tenant_id = auth.uid());
create policy identity_verification_owner_all on identity_verification for all using (tenant_id = auth.uid());
create policy rental_history_owner_all on rental_history for all using (tenant_id = auth.uid());
create policy tenant_references_owner_all on tenant_references for all using (tenant_id = auth.uid());
create policy credit_screenings_owner_all on credit_screenings for all using (tenant_id = auth.uid());
create policy background_screenings_owner_all on background_screenings for all using (tenant_id = auth.uid());
create policy eviction_screenings_owner_all on eviction_screenings for all using (tenant_id = auth.uid());

-- landlords + subscriptions: owner full access
create policy landlords_owner_all on landlords for all using (user_id = auth.uid());
create policy subscriptions_owner_all on subscriptions for all using (landlord_id = auth.uid());

-- properties: public read of active listings; owner full access to their own
create policy properties_public_read_active on properties for select using (status = 'active');
create policy properties_owner_all on properties for all using (landlord_id = auth.uid());
create policy property_photos_public_read on property_photos for select using (
  exists (select 1 from properties p where p.id = property_photos.property_id and p.status = 'active')
);
create policy property_photos_owner_all on property_photos for all using (
  exists (select 1 from properties p where p.id = property_photos.property_id and p.landlord_id = auth.uid())
);

-- matches: tenant reads their own matches
create policy tenant_matches_owner_read on tenant_matches for select using (tenant_id = auth.uid());

-- applications: tenant sees their own; landlord sees applications to their properties
create policy applications_tenant_all on applications for all using (tenant_id = auth.uid());
create policy applications_landlord_read on applications for select using (
  exists (select 1 from properties p where p.id = applications.property_id and p.landlord_id = auth.uid())
);
create policy applications_landlord_update_status on applications for update using (
  exists (select 1 from properties p where p.id = applications.property_id and p.landlord_id = auth.uid())
);

-- conversations + messages: participants only
create policy conversations_participant_all on conversations for all using (
  tenant_id = auth.uid() or landlord_id = auth.uid()
);
create policy messages_participant_read on messages for select using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
  )
);
create policy messages_participant_insert on messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
  )
);

-- saved items: owner only
create policy saved_properties_owner_all on saved_properties for all using (tenant_id = auth.uid());
create policy saved_tenants_owner_all on saved_tenants for all using (landlord_id = auth.uid());

-- notifications: owner read
create policy notifications_owner_read on notifications for select using (user_id = auth.uid());
create policy notifications_owner_update on notifications for update using (user_id = auth.uid());

-- audit logs: owner read only (writes happen via service role / triggers)
create policy audit_logs_owner_read on audit_logs for select using (user_id = auth.uid());

-- disputes: reporter or subject can read; reporter can create
create policy disputes_participant_read on disputes for select using (
  reporter_id = auth.uid() or subject_id = auth.uid()
);
create policy disputes_reporter_insert on disputes for insert with check (reporter_id = auth.uid());

-- Grant SELECT on the view explicitly — Postgres does not do this by default,
-- and the view's own WHERE clause (see its definition above) is what actually
-- restricts which tenant_id rows a given landlord can see.
grant select on tenant_public_profile to authenticated;
