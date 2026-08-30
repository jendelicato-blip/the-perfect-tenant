-- Two-sided marketplace: a landlord needs to discover a broader set of
-- Rental Ready tenants than "already applied or saved" — that was the right
-- default for Phase 1 (a pure application pipeline), but the Tenant
-- Marketplace is explicitly opt-in discovery. Tenants control this
-- themselves via passport_visibility rather than it being implicit.

alter table tenants add column if not exists passport_visibility text not null default 'marketplace'
  check (passport_visibility in ('marketplace', 'applied_or_saved_only', 'private'));

-- Replaces the 0001 definition: same authorization philosophy (a security
-- barrier view with its own WHERE clause, not RLS re-inheritance — see the
-- comment in 0001_init.sql), extended with the marketplace opt-in and the
-- employment/rental-history/references signals the Passport needs for its
-- Rental Ready computation.
--
-- Dropped and recreated rather than CREATE OR REPLACE: Postgres rejects
-- REPLACE when a new column is inserted before existing ones (only
-- appending at the end is allowed), and passport_visibility needed to sit
-- next to the other tenant-identity columns, not tacked on at the end.
drop view if exists tenant_public_profile;

create view tenant_public_profile
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
  exists(select 1 from tenant_references tr where tr.tenant_id = t.user_id and tr.status = 'verified') as references_verified
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

-- tenant_areas has no per-row visibility signal of its own — mirror the same
-- authorization rule as an additional read policy (RLS OR's policies of the
-- same command together, so the owner-only ALL policy from 0001 still holds
-- for writes; this only adds another way to satisfy SELECT).
create policy tenant_areas_marketplace_read on tenant_areas for select using (
  exists (
    select 1 from tenants t
    where t.user_id = tenant_areas.tenant_id
      and (
        t.passport_visibility = 'marketplace'
        or (
          t.passport_visibility = 'applied_or_saved_only'
          and (
            exists (
              select 1 from applications a join properties pr on pr.id = a.property_id
              where a.tenant_id = t.user_id and pr.landlord_id = auth.uid()
            )
            or exists (select 1 from saved_tenants st where st.tenant_id = t.user_id and st.landlord_id = auth.uid())
          )
        )
      )
  )
);
