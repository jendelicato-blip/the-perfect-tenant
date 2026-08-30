-- Perfect Rent™, Perfect Pay™, Perfect Rewards™
--
-- Deliberately NOT built here: any security-deposit or prepaid-rent feature
-- (deposit limits vary by jurisdiction and need real legal review before
-- production use — see jurisdiction_rules below, which is a permissive
-- stub, not real legal data), and any tenant referral/partner-rewards
-- transaction system (out of scope for this pass).
--
-- Perfect Pay is real, not simulated: a payment_verifications row only
-- exists because a landlord affirmatively confirmed it (verified_by =
-- 'landlord_confirmation' is the only source wired up in Phase 1 — the
-- column exists to admit other legitimate sources, e.g. a payment
-- processor integration, later without a schema change).

create type incentive_type as enum ('passport_verified', 'longer_lease', 'auto_payment', 'rental_history', 'upfront_rent');

-- ---------- Compliance stub ----------
-- Permissive by default (every incentive type allowed in every state) —
-- this is NOT real legal data. It exists so the eligibility engine has a
-- real gate to consult (and an admin a real place to restrict a type per
-- state) rather than the app silently assuming every incentive is lawful
-- everywhere. Populate with actual reviewed rules before relying on it.
create table jurisdiction_rules (
  id uuid primary key default uuid_generate_v4(),
  state text not null,
  incentive_type incentive_type not null,
  allowed boolean not null default true,
  note text,
  updated_at timestamptz not null default now(),
  unique (state, incentive_type)
);
alter table jurisdiction_rules enable row level security;
create policy jurisdiction_rules_public_read on jurisdiction_rules for select using (true);
create policy jurisdiction_rules_admin_write on jurisdiction_rules for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- ---------- Perfect Rent™ ----------
create table rent_incentives (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties (id) on delete cascade,
  type incentive_type not null,
  discount_cents int not null check (discount_cents >= 0),
  enabled boolean not null default true,
  requires_lease_months int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, type)
);
alter table rent_incentives enable row level security;
create policy rent_incentives_public_read on rent_incentives for select using (
  enabled and exists (select 1 from properties p where p.id = rent_incentives.property_id and p.status = 'active')
);
create policy rent_incentives_landlord_all on rent_incentives for all using (
  exists (select 1 from properties p where p.id = rent_incentives.property_id and p.landlord_id = auth.uid())
);
create policy rent_incentives_admin_read on rent_incentives for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- A tenant-level opt-in (not a bank integration) — "I agree to use an
-- approved automatic payment method" as a durable Passport attribute,
-- independent of any one property.
alter table tenants add column if not exists auto_payment_enrolled boolean not null default false;

-- ---------- Perfect Pay™ ----------
create table payment_verifications (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  property_id uuid not null references properties (id) on delete cascade,
  landlord_id uuid not null references landlords (user_id) on delete cascade,
  period_start date not null,
  status text not null default 'on_time' check (status in ('on_time', 'late', 'disputed')),
  verified_by text not null default 'landlord_confirmation',
  verified_at timestamptz not null default now(),
  unique (tenant_id, property_id, period_start)
);
alter table payment_verifications enable row level security;
create policy payment_verifications_tenant_read on payment_verifications for select using (tenant_id = auth.uid());
create policy payment_verifications_landlord_all on payment_verifications for all using (landlord_id = auth.uid());
create policy payment_verifications_admin_read on payment_verifications for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- Admin-configurable Perfect Pay tiers (consecutive on-time payments
-- required). Seeded with Bronze/Silver/Gold/Platinum but never hard-coded
-- in the client.
create table perfect_pay_milestones (
  level text primary key,
  consecutive_payments_required int not null,
  sort_order int not null
);
alter table perfect_pay_milestones enable row level security;
create policy perfect_pay_milestones_public_read on perfect_pay_milestones for select using (true);
create policy perfect_pay_milestones_admin_write on perfect_pay_milestones for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

insert into perfect_pay_milestones (level, consecutive_payments_required, sort_order) values
  ('new', 0, 0),
  ('bronze', 6, 1),
  ('silver', 12, 2),
  ('gold', 24, 3),
  ('platinum', 36, 4);

-- ---------- Perfect Rewards™ / audit ----------
create table reward_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  type text not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table reward_events enable row level security;
create policy reward_events_tenant_read on reward_events for select using (tenant_id = auth.uid());
-- Insertable by the tenant themselves (a milestone/eligibility event they
-- triggered just by viewing a page) or by a landlord who has recorded at
-- least one payment for that tenant (a milestone their payment-recording
-- action just caused).
create policy reward_events_insert on reward_events for insert with check (
  tenant_id = auth.uid()
  or exists (
    select 1 from payment_verifications pv
    where pv.tenant_id = reward_events.tenant_id and pv.landlord_id = auth.uid()
  )
);
create policy reward_events_admin_read on reward_events for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
