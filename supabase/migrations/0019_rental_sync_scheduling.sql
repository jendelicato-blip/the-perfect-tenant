-- Rental Property Aggregation Engine — scheduled sync (spec section 16).
--
-- Enables pg_cron/pg_net (both already available on this project's Postgres
-- version, just not turned on) and wires up the actual schedule: every 15
-- minutes, call the rental-sync-cron Edge Function, which finds any active
-- source with a feed_url + sync_interval_minutes whose interval has elapsed
-- and re-syncs it — see supabase/functions/rental-sync-cron/index.ts for the
-- full pipeline (fetch -> normalize -> validate -> match -> upsert).
--
-- Authentication: the Edge Function is deployed with verify_jwt=false (there
-- is no Supabase user session for pg_cron to attach a JWT for) and instead
-- checks a shared secret via verify_rental_sync_cron_secret() below. That
-- function is SECURITY DEFINER so it can read vault.decrypted_secrets (not
-- otherwise exposed to any role, and not reachable at all through PostgREST —
-- see the Edge Function's own comment on why it calls this as an RPC rather
-- than querying the vault schema directly), but it only ever returns a
-- boolean — never the secret's value — and only service_role may execute it,
-- so the Edge Function (using the service-role key) can call it but no
-- application user ever could. The actual secret was stored via
-- `select vault.create_secret(...)` run directly against the project, never
-- written into a migration file or committed to git.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.verify_rental_sync_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'rental_sync_cron_secret' and decrypted_secret = candidate
  );
$$;

revoke all on function public.verify_rental_sync_cron_secret(text) from public;
revoke all on function public.verify_rental_sync_cron_secret(text) from anon;
revoke all on function public.verify_rental_sync_cron_secret(text) from authenticated;
grant execute on function public.verify_rental_sync_cron_secret(text) to service_role;

-- The cron job's body executes as plain SQL inside Postgres (never through
-- PostgREST), so it CAN read vault.decrypted_secrets directly — the
-- restriction the RPC above works around only applies to REST API callers
-- like the Edge Function's own supabase-js client.
select cron.schedule(
  'rental-sync-cron-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xbpsuwmmpqltnifmjptb.supabase.co/functions/v1/rental-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rental_sync_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
