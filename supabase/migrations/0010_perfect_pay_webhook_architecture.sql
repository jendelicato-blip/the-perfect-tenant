-- Webhook architecture for Perfect Pay™ payment security.
--
-- This is the RECEIVING half of a two-sided integration whose SENDING half
-- doesn't exist yet: nothing in this app currently creates a Stripe
-- PaymentIntent or Connect transfer for rent (Perfect Pay is Phase 1
-- landlord-confirmed only — see the note above payment_verifications in
-- 0005_perfect_rent_pay_rewards.sql). Until a real charge-creation flow is
-- built and Stripe Connect is actually configured, nothing ever calls the
-- webhook endpoint this table supports — this is real, correct,
-- currently-unreachable infrastructure, not a fabricated integration. See
-- supabase/functions/perfect-pay-webhook/index.ts.
--
-- Idempotency: Stripe (and any comparable provider) guarantees only
-- at-least-once delivery, so the same event id can arrive more than once.
-- The webhook handler claims an event by inserting its id here BEFORE
-- doing any real work; a unique-violation on that insert means "already
-- claimed" and the event is skipped rather than reprocessed. A NULL
-- processed_at after received_at (with no matching update) means a prior
-- attempt crashed mid-processing — a real signal for manual review, not
-- silently swallowed.
create table webhook_events (
  id text primary key, -- the provider's own event id (e.g. Stripe's evt_...) — this IS the idempotency key
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table webhook_events enable row level security;
-- No public policies for tenants/landlords — only the service-role key the
-- Edge Function itself uses (which bypasses RLS) ever writes here. Admin
-- gets read access for the observability panel at /admin, same pattern as
-- every other admin-read policy in this schema.
create policy webhook_events_admin_read on webhook_events for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);
