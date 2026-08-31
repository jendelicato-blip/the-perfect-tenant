-- The Perfect10ant™ — Passport, marketplace, verification, and billing extensions.
-- Additive to 0001_init.sql; nothing here removes or narrows existing access.

-- ---------- Landlord verification ----------
alter table landlords add column if not exists identity_verified boolean not null default false;
alter table landlords add column if not exists contact_verified boolean not null default false;
alter table landlords add column if not exists business_verified boolean not null default false;
alter table landlords add column if not exists verified_at timestamptz;

-- ---------- Admin flag (gates subscription_plans writes below) ----------
alter table public.users add column if not exists is_admin boolean not null default false;

-- ---------- Perfect Match™ inputs: parking + amenities ----------
alter table tenant_preferences add column if not exists parking_required boolean not null default false;
alter table tenant_preferences add column if not exists desired_amenities text[] not null default '{}';

-- ---------- Landlord → tenant "Invite to Apply" ----------
create type invitation_status as enum ('sent', 'accepted', 'declined');

create table tenant_invitations (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  status invitation_status not null default 'sent',
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
alter table tenant_invitations enable row level security;
create policy tenant_invitations_landlord_all on tenant_invitations for all using (landlord_id = auth.uid());
create policy tenant_invitations_tenant_read on tenant_invitations for select using (tenant_id = auth.uid());
create policy tenant_invitations_tenant_respond on tenant_invitations for update using (tenant_id = auth.uid());

-- ---------- Tenant → landlord "I'm Interested" ----------
create table tenant_interests (
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, property_id)
);
alter table tenant_interests enable row level security;
create policy tenant_interests_owner_all on tenant_interests for all using (tenant_id = auth.uid());
create policy tenant_interests_landlord_read on tenant_interests for select using (
  exists (select 1 from properties p where p.id = tenant_interests.property_id and p.landlord_id = auth.uid())
);

-- ---------- Passport sharing + view history ----------
create table passport_shares (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  landlord_id uuid references landlords (user_id) on delete cascade,
  share_token uuid unique not null default uuid_generate_v4(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table passport_shares enable row level security;
create policy passport_shares_owner_all on passport_shares for all using (tenant_id = auth.uid());
create policy passport_shares_landlord_read on passport_shares for select using (landlord_id = auth.uid());

create table passport_views (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  viewer_landlord_id uuid not null references landlords (user_id) on delete cascade,
  viewed_at timestamptz not null default now()
);
alter table passport_views enable row level security;
create policy passport_views_tenant_read on passport_views for select using (tenant_id = auth.uid());
create policy passport_views_landlord_insert on passport_views for insert with check (viewer_landlord_id = auth.uid());
create policy passport_views_landlord_read on passport_views for select using (viewer_landlord_id = auth.uid());

-- ---------- Landlord reviews ----------
-- Eligibility guard against retaliatory/fraudulent reviews: a tenant may only
-- review a landlord for a property they had an *approved* application on —
-- not just anyone who browsed a listing.
create table landlord_reviews (
  id uuid primary key default uuid_generate_v4(),
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid references properties (id) on delete set null,
  communication_rating int not null check (communication_rating between 1 and 5),
  maintenance_rating int not null check (maintenance_rating between 1 and 5),
  accuracy_rating int not null check (accuracy_rating between 1 and 5),
  professionalism_rating int not null check (professionalism_rating between 1 and 5),
  move_in_rating int not null check (move_in_rating between 1 and 5),
  overall_rating numeric(2, 1) not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (landlord_id, tenant_id, property_id)
);
alter table landlord_reviews enable row level security;
create policy landlord_reviews_public_read on landlord_reviews for select using (true);
create policy landlord_reviews_tenant_insert on landlord_reviews for insert with check (
  tenant_id = auth.uid()
  and exists (
    select 1 from applications a
    where a.tenant_id = auth.uid() and a.property_id = landlord_reviews.property_id and a.status = 'approved'
  )
);

-- ---------- Configurable subscription pricing ----------
-- Never hard-code landlord pricing in the client — the Pricing page reads
-- this table. Writes are restricted to admins (public.users.is_admin).
create table subscription_plans (
  tier subscription_tier primary key,
  name text not null,
  price_cents int not null,
  billing_period text not null default 'month',
  features text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table subscription_plans enable row level security;
create policy subscription_plans_public_read on subscription_plans for select using (active);
create policy subscription_plans_admin_write on subscription_plans for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

insert into subscription_plans (tier, name, price_cents, features) values
  ('starter', 'Starter', 2900, array['1 active listing', 'Basic match scoring', 'Messaging']),
  ('growth', 'Growth', 7900, array['10 active listings', 'Priority match ranking', 'Saved tenants', 'Email support']),
  ('portfolio', 'Portfolio', 19900, array['Unlimited listings', 'Team seats', 'Applicant analytics', 'Priority support']);
