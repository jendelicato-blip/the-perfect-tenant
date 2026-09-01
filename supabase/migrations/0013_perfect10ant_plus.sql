-- Perfect10ant Plus™ — a recurring tenant membership, separate from the
-- one-time Perfect10ant Verified™ purchase (0011). Its flagship benefit is a
-- real Document Vault (Supabase Storage), not just a re-wrapping of
-- already-free features — see the note in src/types/domain.ts above
-- TenantPlusMembership for the reasoning.

-- Admin-configurable pricing/copy — same singleton-row pattern as
-- verified_tier_config (0011) and platform_fee_config (0007).
create table plus_membership_config (
  id text primary key default 'default',
  price_cents int not null default 999,
  name text not null default 'Perfect10ant Plus',
  description text not null default 'Enhanced Passport, Document Vault, and priority Passport sharing.',
  billing_period text not null default 'month',
  updated_at timestamptz not null default now()
);
insert into plus_membership_config (id) values ('default');

alter table plus_membership_config enable row level security;
create policy plus_membership_config_public_read on plus_membership_config for select using (true);
create policy plus_membership_config_admin_write on plus_membership_config for update using (
  exists (select 1 from users u where u.id = auth.uid() and u.is_admin)
);

-- A tenant's own membership record. Singleton per tenant (not a purchase
-- log like verified_purchases, since this is recurring/cancelable state,
-- not a one-time event) — same shape as the landlord `subscriptions` table.
create table tenant_plus_memberships (
  tenant_id uuid primary key references users (id),
  status text not null default 'active' check (status in ('active', 'canceled')),
  stripe_customer_id text,
  started_at timestamptz not null default now(),
  renews_at timestamptz
);
alter table tenant_plus_memberships enable row level security;
-- Same Phase-1 allowance as subscriptions_owner_all (0001) and
-- verified_purchases_owner_insert (0011): lets activatePlusDirect simulate
-- activation/cancellation when no live Stripe project is configured. The
-- real path (Stripe webhook, service role) bypasses RLS regardless.
create policy tenant_plus_memberships_owner_all on tenant_plus_memberships for all using (tenant_id = auth.uid());
-- Same admin-read pattern as verified_purchases_admin_read (0011) — Admin
-- metrics (plusActiveMembersCount/plusMrrCents) need to read across all
-- tenants, not just their own row.
create policy tenant_plus_memberships_admin_read on tenant_plus_memberships for select using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

-- Document Vault metadata — the actual file bytes live in the
-- tenant-documents Storage bucket below; this table is what makes them
-- listable/categorized/deletable. Gating "Document Vault requires an active
-- Plus membership" happens in the UI (Plus.tsx), the same way every other
-- paid-tier gate in this app works — RLS's job here is ownership (a tenant
-- only ever sees their own documents), not membership-tier enforcement.
create table tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references users (id),
  category text not null check (category in ('identity', 'income', 'lease', 'other')),
  file_name text not null,
  storage_path text not null unique,
  size_bytes int not null,
  uploaded_at timestamptz not null default now()
);
create index tenant_documents_tenant_idx on tenant_documents (tenant_id, uploaded_at desc);
alter table tenant_documents enable row level security;
create policy tenant_documents_owner_all on tenant_documents for all using (tenant_id = auth.uid());

-- Real Supabase Storage bucket — private (public = false); every read/write
-- goes through a signed URL or an authenticated request that satisfies the
-- policies below, never a public URL. Path convention: `{tenant_id}/{file}`
-- — storage.foldername(name) splits the path so policies can check the
-- first segment against auth.uid() without a join back to this schema.
insert into storage.buckets (id, name, public) values ('tenant-documents', 'tenant-documents', false)
on conflict (id) do nothing;

create policy tenant_documents_storage_owner_all on storage.objects for all using (
  bucket_id = 'tenant-documents' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'tenant-documents' and (storage.foldername(name))[1] = auth.uid()::text
);
