-- Perfect Pay™ Autopay (simulated payment provider layer)
--
-- Deliberately NOT built here: any real payment-processor/Stripe Connect
-- integration (tokenization, webhooks, payouts, refunds/disputes). This
-- phase only stores what a real provider's tokenization would hand back
-- (a payment method type + last 4 digits, a connected/disconnected payout
-- flag + last 4) — never a real bank/card number, CVV, or credential.
-- Actual rent payments still only ever become "verified" through
-- payment_verifications (see 0005), i.e. a landlord affirmatively
-- confirming receipt — nothing in this migration marks a payment
-- successful on its own.

alter table tenants add column if not exists payment_method_type text check (payment_method_type in ('bank', 'card'));
alter table tenants add column if not exists payment_method_last4 text;
alter table tenants add column if not exists autopay_day int check (autopay_day between 1 and 28);

-- Who funds an enabled incentive's discount — see IncentiveFundingSource in
-- src/types/domain.ts. Defaults to 'landlord' (the existing behavior before
-- this column existed: the landlord's payout is reduced by the discount).
alter table rent_incentives add column if not exists funded_by text not null default 'landlord' check (funded_by in ('landlord', 'platform'));

-- ---------- Landlord payout connection (simulated) ----------
create table landlord_payout_accounts (
  landlord_id uuid primary key references landlords (user_id) on delete cascade,
  connected boolean not null default false,
  last4 text,
  payout_schedule text not null default 'monthly' check (payout_schedule in ('daily', 'weekly', 'monthly')),
  connected_at timestamptz
);
alter table landlord_payout_accounts enable row level security;
create policy landlord_payout_accounts_owner on landlord_payout_accounts for all using (landlord_id = auth.uid());
create policy landlord_payout_accounts_admin_read on landlord_payout_accounts for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- ---------- Platform fee config ----------
-- Singleton row, same pattern as ad_frequency_rules (0006) — an actual
-- admin-editable ceiling on what Perfect10ant charges, never hard-coded in
-- the client. Read-only to landlords/tenants for fee disclosure purposes.
create table platform_fee_config (
  id int primary key default 1 check (id = 1),
  percent_fee numeric not null default 0,
  flat_fee_cents int not null default 0,
  fee_payer text not null default 'landlord' check (fee_payer in ('landlord', 'tenant')),
  updated_at timestamptz not null default now()
);
insert into platform_fee_config (id) values (1);
alter table platform_fee_config enable row level security;
create policy platform_fee_config_public_read on platform_fee_config for select using (true);
create policy platform_fee_config_admin_write on platform_fee_config for all using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
