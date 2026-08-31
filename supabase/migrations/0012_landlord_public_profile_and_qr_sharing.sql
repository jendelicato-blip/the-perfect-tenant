-- Landlord public profile: a narrow, safe view exposing only what a tenant
-- legitimately needs to see about a landlord (company name, the "✓ Verified
-- Landlord" flags, email for display) — never the landlords/users base
-- tables directly, which are owner-read-only (landlords_owner_all,
-- users_select_self). Same security-barrier pattern as tenant_public_profile
-- (0004) and landlord_visible_autopay (0008).
--
-- Fixes a real pre-existing gap: PropertyDetail.tsx has always called
-- getLandlordProfile (reading the landlords table directly) to show the
-- "✓ Verified Landlord" badge to a TENANT browsing a listing — RLS silently
-- returned nothing to that caller (only the landlord themselves could read
-- their own row), so the badge never actually rendered for a tenant on a
-- live Supabase project. getLandlordPublicProfile (new, tenant-facing) reads
-- this view instead; getLandlordProfile (landlord reading their OWN
-- dashboard) is untouched.
create view landlord_public_profile
with (security_barrier = true, security_invoker = false) as
select
  l.user_id as landlord_id,
  u.email,
  l.company_name,
  l.identity_verified,
  l.contact_verified,
  l.business_verified,
  l.verified_at
from landlords l
join users u on u.id = l.user_id;

grant select on landlord_public_profile to authenticated;
