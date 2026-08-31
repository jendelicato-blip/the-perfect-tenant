-- Refund and dispute workflows for Perfect Pay™.
--
-- Both stay on the same honesty boundary as the rest of Perfect Pay: a
-- Dispute here is a tenant's disagreement with a landlord-confirmed
-- payment_verifications row, layered ON TOP of it — filing one never
-- overwrites the landlord's own recorded status (on_time/late/disputed is
-- the landlord's own attestation; this is the tenant's separate objection
-- to it). A PaymentRefund is the landlord's own record that they owe or
-- returned money — not a real reversed transaction, since no payment
-- processor exists yet to actually reverse anything (same boundary as
-- every other "money" concept in this phase — see 0007/0008).
--
-- "Duplicate payment" and "failed payment" from the build plan's list
-- don't apply here the way they would with a real processor: recordPayment
-- already upserts on the (tenant_id, property_id, period_start) unique
-- constraint from 0005, so a second attempt to record the same period
-- corrects the existing row rather than creating a duplicate — there's no
-- webhook retry/idempotency problem to solve because there's no webhook.

alter table disputes add column if not exists payment_verification_id uuid references payment_verifications(id) on delete cascade;
alter table disputes add column if not exists category text check (category in ('incorrect_amount', 'not_received', 'duplicate_charge', 'other'));

-- 0001 only ever let the reporter create a dispute and either party read
-- it — nobody could change its status. The "subject" (here: the landlord
-- a payment dispute is filed against) needs to be able to resolve/dismiss.
create policy disputes_subject_update on disputes for update using (subject_id = auth.uid()) with check (subject_id = auth.uid());

create table payment_refunds (
  id uuid primary key default uuid_generate_v4(),
  payment_verification_id uuid not null references payment_verifications(id) on delete cascade,
  landlord_id uuid not null references landlords(user_id) on delete cascade,
  tenant_id uuid not null references tenants(user_id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  type text not null check (type in ('full', 'partial')),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table payment_refunds enable row level security;
create policy payment_refunds_tenant_read on payment_refunds for select using (tenant_id = auth.uid());
create policy payment_refunds_landlord_all on payment_refunds for all using (landlord_id = auth.uid());
create policy payment_refunds_admin_read on payment_refunds for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
