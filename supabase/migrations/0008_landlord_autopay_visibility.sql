-- Perfect Pay™ reconciliation reporting (payout history, monthly collection
-- report) needs one more signal a landlord doesn't otherwise have access to:
-- whether their own approved tenant has Perfect Pay Autopay enrolled, for
-- the report's "Autopay rate" line. tenant_public_profile deliberately
-- hardcodes this to false everywhere (see supabaseApi.ts) since it's a
-- marketplace-wide view — this is a narrower, security-barrier view in the
-- same spirit as tenant_public_profile (0001/0004), but scoped to only the
-- landlord who actually has an approved-application relationship with that
-- tenant, and exposing only the one boolean needed — never
-- payment_method_type/last4, which stay private per the domain.ts note on
-- those fields.

create view landlord_visible_autopay
with (security_barrier = true, security_invoker = false) as
select distinct
  a.tenant_id,
  p.landlord_id,
  t.auto_payment_enrolled
from applications a
join properties p on p.id = a.property_id
join tenants t on t.user_id = a.tenant_id
where a.status = 'approved' and p.landlord_id = auth.uid();

grant select on landlord_visible_autopay to authenticated;
