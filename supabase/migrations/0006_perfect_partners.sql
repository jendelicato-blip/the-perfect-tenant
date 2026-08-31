-- Perfect Partners™: Sponsored Properties, Featured Landlord, and the
-- Perfect Partners advertising directory / member offers.
--
-- CORE RULE, enforced structurally, not just by convention: paid placement
-- can only change VISIBILITY (position, "Sponsored" labeling), never the
-- Perfect Match™ score. Nothing in this file touches tenant_matches or any
-- column scoreMatch() reads, and no targeting field anywhere below is a
-- protected characteristic — only geography (city/state/zip/radius) and
-- campaign category exist to target on. See src/lib/perfectPartners/engine.ts,
-- which interleaves sponsored properties into an already-scored result list
-- without ever touching the score field.
--
-- Deliberately NOT built here (see README "What's deferred"): a separate
-- self-service third-party advertiser signup flow/portal (Phase 1 only
-- supports a landlord promoting their own property, plus admin-managed
-- Perfect Partners), real advertiser billing/Stripe integration for campaign
-- purchases (same Phase 1 stub pattern used for subscription_plans
-- elsewhere — approving a campaign records a real ad_revenue_events row
-- from the real configured package price, but no card is ever charged), and
-- per-user ad-impression tracking (impressions/clicks are anonymous
-- counters with no tenant_id column, to minimize personal data collected).
-- sponsored_properties / featured_landlords are not separate tables —
-- ad_campaigns.property_id / landlord_id cover both directly, which is
-- simpler than the join-table shape implied by the original build plan
-- without losing any capability.

create type ad_category as enum ('real_estate', 'moving', 'home_services', 'financial_insurance', 'utilities', 'home_products');
create type campaign_type as enum ('sponsored_property', 'featured_landlord', 'perfect_partner', 'partner_deal');
create type campaign_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'expired');

-- ---------- Advertisers ----------
-- owner_landlord_id is set only when a landlord is self-promoting their own
-- property; null means this row is a platform-managed, admin-onboarded
-- Perfect Partner. There is no separate third-party advertiser signup/login
-- role in this pass.
create table advertisers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category ad_category not null,
  website text,
  contact_email text,
  owner_landlord_id uuid references landlords (user_id) on delete cascade,
  verified_business boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table advertisers enable row level security;
create policy advertisers_owner_all on advertisers for all using (owner_landlord_id = auth.uid());
create policy advertisers_admin_all on advertisers for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
-- Tenants never read this table directly (it can hold contact_email) — they
-- only ever see advertiser-derived display fields via ad_campaigns'
-- public-read policy and perfect_partners/partner_offers below.

-- ---------- Ad packages (admin-configurable pricing, never hard-coded) ----------
create table ad_packages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  campaign_type campaign_type not null,
  duration_days int not null check (duration_days > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean not null default true,
  sort_order int not null default 0
);
alter table ad_packages enable row level security;
create policy ad_packages_public_read on ad_packages for select using (active);
create policy ad_packages_admin_write on ad_packages for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

insert into ad_packages (name, campaign_type, duration_days, price_cents, active, sort_order) values
  ('7-Day Boost', 'sponsored_property', 7, 999, true, 0),
  ('14-Day Featured', 'sponsored_property', 14, 1999, true, 1),
  ('30-Day Featured', 'sponsored_property', 30, 2999, true, 2),
  ('Premium Featured', 'sponsored_property', 30, 4999, true, 3);

-- ---------- Campaigns ----------
-- No demographic/protected-characteristic targeting field exists anywhere
-- on this table by design — only geography and campaign type (compliance by
-- omission, see build-plan section on Fair Housing). A campaign starts in
-- 'pending_review' and only becomes visible to tenants once an admin
-- approves it (ad_campaigns_public_read_active below) — nothing here
-- auto-publishes an unreviewed advertiser.
create table ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  advertiser_id uuid not null references advertisers (id) on delete cascade,
  campaign_type campaign_type not null,
  status campaign_status not null default 'pending_review',
  property_id uuid references properties (id) on delete cascade,
  landlord_id uuid references landlords (user_id) on delete cascade,
  package_id uuid references ad_packages (id),
  target_city text,
  target_state text,
  target_zip text,
  target_radius_miles int,
  headline text not null,
  description text,
  offer_text text,
  cta_label text not null default 'Learn more',
  destination_url text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table ad_campaigns enable row level security;
create policy ad_campaigns_owner_all on ad_campaigns for all using (
  exists (select 1 from advertisers a where a.id = ad_campaigns.advertiser_id and a.owner_landlord_id = auth.uid())
);
create policy ad_campaigns_admin_all on ad_campaigns for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
-- Approved + currently date-active campaigns are readable by anyone — a
-- tenant browsing needs to see which properties are sponsored (labeled, per
-- the advertising promise) and this exposes only display fields, never
-- advertiser contact/billing data (that stays on `advertisers`).
create policy ad_campaigns_public_read_active on ad_campaigns for select using (
  status = 'approved'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- ---------- Perfect Partners™ directory + member offers ----------
-- Admin-managed only in this pass (no self-service advertiser onboarding
-- flow yet). Seeded with a small number of clearly example/placeholder
-- entries, consistent with the rest of this app's demo seed data — do not
-- treat these as real partnerships; replace with actual reviewed
-- partnerships before production use.
create table perfect_partners (
  id uuid primary key default uuid_generate_v4(),
  advertiser_id uuid references advertisers (id) on delete set null,
  category ad_category not null,
  name text not null,
  emoji text not null default '🤝',
  tagline text,
  active boolean not null default true,
  sort_order int not null default 0
);
alter table perfect_partners enable row level security;
create policy perfect_partners_public_read on perfect_partners for select using (active);
create policy perfect_partners_admin_write on perfect_partners for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

create table partner_offers (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references perfect_partners (id) on delete cascade,
  title text not null,
  description text not null,
  offer_text text not null,
  promo_code text,
  cta_label text not null default 'Get Offer',
  destination_url text,
  expires_at timestamptz,
  active boolean not null default true
);
alter table partner_offers enable row level security;
create policy partner_offers_public_read on partner_offers for select using (active);
create policy partner_offers_admin_write on partner_offers for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- A tenant clicking "Get Offer" — used both to reveal the promo code to
-- them and to count real leads (never fabricated) in landlord/admin
-- analytics. One row per tenant per offer so repeated clicks don't inflate
-- the lead count.
create table offer_redemptions (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references partner_offers (id) on delete cascade,
  tenant_id uuid not null references tenants (user_id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (offer_id, tenant_id)
);
alter table offer_redemptions enable row level security;
create policy offer_redemptions_tenant_all on offer_redemptions for all using (tenant_id = auth.uid());
create policy offer_redemptions_admin_read on offer_redemptions for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- ---------- Impressions / clicks (anonymous counters) ----------
-- Deliberately no tenant/user identifier here — the advertising analytics
-- requirement is aggregate counts, not a per-user ad-tracking profile.
-- Insertable by anyone (a fire-and-forget beacon, same as any ad network's
-- impression pixel) since the row itself carries no personal data; reads
-- are restricted to the campaign's own owner and admin.
create table ad_impressions (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references ad_campaigns (id) on delete cascade,
  offer_id uuid references partner_offers (id) on delete cascade,
  placement text not null,
  occurred_at timestamptz not null default now(),
  check (campaign_id is not null or offer_id is not null)
);
alter table ad_impressions enable row level security;
create policy ad_impressions_insert_any on ad_impressions for insert with check (true);
create policy ad_impressions_admin_read on ad_impressions for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
create policy ad_impressions_owner_read on ad_impressions for select using (
  exists (
    select 1 from ad_campaigns c join advertisers a on a.id = c.advertiser_id
    where c.id = ad_impressions.campaign_id and a.owner_landlord_id = auth.uid()
  )
);

create table ad_clicks (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references ad_campaigns (id) on delete cascade,
  offer_id uuid references partner_offers (id) on delete cascade,
  placement text not null,
  occurred_at timestamptz not null default now(),
  check (campaign_id is not null or offer_id is not null)
);
alter table ad_clicks enable row level security;
create policy ad_clicks_insert_any on ad_clicks for insert with check (true);
create policy ad_clicks_admin_read on ad_clicks for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
create policy ad_clicks_owner_read on ad_clicks for select using (
  exists (
    select 1 from ad_campaigns c join advertisers a on a.id = c.advertiser_id
    where c.id = ad_clicks.campaign_id and a.owner_landlord_id = auth.uid()
  )
);

-- ---------- Ad frequency rules (singleton config, admin-editable) ----------
-- "Useful, relevant, never overwhelming" as an actual configurable ceiling,
-- not just a design intention — see interleaveSponsoredProperties() and
-- selectPartnerOffers() in src/lib/perfectPartners/engine.ts, both of which
-- read this table's values (never a hard-coded constant) before rendering
-- any sponsored content.
create table ad_frequency_rules (
  id int primary key default 1 check (id = 1),
  max_sponsored_properties_per_page int not null default 1,
  max_partner_cards_per_page int not null default 2,
  ads_enabled boolean not null default true
);
alter table ad_frequency_rules enable row level security;
create policy ad_frequency_rules_public_read on ad_frequency_rules for select using (true);
create policy ad_frequency_rules_admin_write on ad_frequency_rules for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
insert into ad_frequency_rules (id, max_sponsored_properties_per_page, max_partner_cards_per_page, ads_enabled) values (1, 1, 2, true);

-- ---------- Advertising revenue ----------
-- A real event tied to a real admin approval action and a real configured
-- package price — never a fabricated number. Created only when an admin
-- approves a paid (package_id not null) campaign; this is what the Admin
-- "Advertising Revenue" dashboard sums, the same way MRR sums real
-- subscription_plans prices rather than inventing a number.
create table ad_revenue_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references ad_campaigns (id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
alter table ad_revenue_events enable row level security;
create policy ad_revenue_events_admin_read on ad_revenue_events for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
create policy ad_revenue_events_owner_read on ad_revenue_events for select using (
  exists (
    select 1 from ad_campaigns c join advertisers a on a.id = c.advertiser_id
    where c.id = ad_revenue_events.campaign_id and a.owner_landlord_id = auth.uid()
  )
);
create policy ad_revenue_events_insert_admin on ad_revenue_events for insert with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
