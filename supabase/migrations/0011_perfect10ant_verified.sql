-- Perfect10ant Verified™ — a paid one-time verification-tier purchase,
-- distinct from a landlord's recurring subscription (subscriptions table,
-- 0001). See the comment above VerifiedTierConfig/VerifiedPurchase in
-- src/types/domain.ts for what this does and doesn't claim.

-- Admin-configurable pricing/copy — same singleton-row pattern as
-- platform_fee_config (0007) and ad_frequency_rules (0006). Public SELECT
-- because a tenant needs to see the price before purchasing.
create table verified_tier_config (
  id text primary key default 'default',
  price_cents int not null default 2999,
  name text not null default 'Perfect10ant Verified',
  description text not null default 'Independent verification of your identity, income, and rental history.',
  updated_at timestamptz not null default now()
);
insert into verified_tier_config (id) values ('default');

alter table verified_tier_config enable row level security;
create policy verified_tier_config_public_read on verified_tier_config for select using (true);
create policy verified_tier_config_admin_write on verified_tier_config for update using (
  exists (select 1 from users u where u.id = auth.uid() and u.is_admin)
);

-- A real record of a completed purchase. amount_paid_cents is what was
-- actually charged (captured at purchase time), independent of whatever
-- verified_tier_config.price_cents is later changed to, so historical
-- purchases never appear to retroactively change price.
create table verified_purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references users (id),
  amount_paid_cents int not null,
  stripe_session_id text unique,
  purchased_at timestamptz not null default now()
);
create index verified_purchases_tenant_idx on verified_purchases (tenant_id, purchased_at desc);

alter table verified_purchases enable row level security;
create policy verified_purchases_owner_read on verified_purchases for select using (tenant_id = auth.uid());
-- Same admin-read pattern as webhook_events_admin_read (0010) — Admin
-- metrics (perfect10antVerifiedTenants/verifiedRevenueCents) need to read
-- across all tenants, not just their own row.
create policy verified_purchases_admin_read on verified_purchases for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
-- Same Phase-1 allowance as subscriptions_owner_all (0001): a tenant can
-- write their own row directly, which is what lets purchaseVerifiedDirect
-- simulate a purchase for testing when no live Stripe project is
-- configured — see the data-layer comment there. The real path (Stripe
-- webhook, service role) bypasses RLS entirely and doesn't need this.
create policy verified_purchases_owner_insert on verified_purchases for insert with check (tenant_id = auth.uid());

-- Extends the 0004 view with one more visibility-gated boolean, reusing its
-- exact WHERE clause — appended at the end so CREATE OR REPLACE VIEW is
-- legal (Postgres rejects inserting a new column before existing ones).
create or replace view tenant_public_profile
with (security_barrier = true, security_invoker = false) as
select
  t.user_id as tenant_id,
  u.email,
  t.intro_text,
  t.photo_url,
  t.household_size,
  t.lease_pref_months,
  t.passport_visibility,
  p.min_rent,
  p.max_rent,
  p.beds,
  p.baths,
  p.property_types,
  p.move_in_date,
  p.pets,
  p.parking_required,
  p.desired_amenities,
  coalesce(iv.status, 'not_started') as identity_status,
  coalesce(inc.status, 'not_started') as income_status,
  coalesce(emp.status, 'not_started') as employment_status,
  coalesce(cs.status, 'not_started') as credit_status,
  coalesce(bs.status, 'not_started') as background_status,
  coalesce(es.status, 'not_started') as eviction_status,
  exists(select 1 from rental_history rh where rh.tenant_id = t.user_id and rh.status = 'verified') as rental_history_verified,
  exists(select 1 from tenant_references tr where tr.tenant_id = t.user_id and tr.status = 'verified') as references_verified,
  exists(select 1 from verified_purchases vp where vp.tenant_id = t.user_id) as perfect10ant_verified
from tenants t
join users u on u.id = t.user_id
left join tenant_preferences p on p.tenant_id = t.user_id
left join identity_verification iv on iv.tenant_id = t.user_id
left join income_verification inc on inc.tenant_id = t.user_id
left join employment emp on emp.tenant_id = t.user_id
left join credit_screenings cs on cs.tenant_id = t.user_id
left join background_screenings bs on bs.tenant_id = t.user_id
left join eviction_screenings es on es.tenant_id = t.user_id
where
  t.user_id = auth.uid()
  or t.passport_visibility = 'marketplace'
  or (
    t.passport_visibility = 'applied_or_saved_only'
    and (
      exists (
        select 1 from applications a join properties pr on pr.id = a.property_id
        where a.tenant_id = t.user_id and pr.landlord_id = auth.uid()
      )
      or exists (select 1 from saved_tenants st where st.tenant_id = t.user_id and st.landlord_id = auth.uid())
    )
  );

grant select on tenant_public_profile to authenticated;
