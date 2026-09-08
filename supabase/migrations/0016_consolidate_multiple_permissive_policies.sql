-- Performance fix flagged by Supabase's advisor (multiple_permissive_policies):
-- these tables had 2+ separate permissive policies applicable to the same
-- role+command (e.g. an owner ALL policy plus a separate admin/public SELECT
-- policy), which forces Postgres to evaluate every one of them and OR the
-- results for every row. Consolidating each (table, command) pair into a
-- single policy with the equivalent OR'd condition is functionally identical
-- (exact same rows visible/writable) but is evaluated once instead of N times.
-- An ALL policy can't be scoped to "every command except SELECT", so wherever
-- an ALL policy needed to lose its SELECT clause to a merged policy, it's
-- replaced by three explicit INSERT/UPDATE/DELETE policies carrying its
-- original condition unchanged.
--
-- Applied directly to the live project on 2026-09-08 (see chat history) and
-- verified there via simulated per-role RLS queries (tenant/landlord isolation,
-- public-config reads, admin-only writes, and the two split ALL policies'
-- UPDATE paths all behave identically to before); this file brings the repo's
-- migration history back in sync with what's already live.

drop policy "landlord_payout_accounts_owner" on public.landlord_payout_accounts;
drop policy "landlord_payout_accounts_admin_read" on public.landlord_payout_accounts;
create policy "landlord_payout_accounts_rw_select" on public.landlord_payout_accounts for select using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))));
create policy "landlord_payout_accounts_rw_insert" on public.landlord_payout_accounts for insert with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "landlord_payout_accounts_rw_update" on public.landlord_payout_accounts for update using ((landlord_id = ( SELECT auth.uid() AS uid))) with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "landlord_payout_accounts_rw_delete" on public.landlord_payout_accounts for delete using ((landlord_id = ( SELECT auth.uid() AS uid)));

drop policy "offer_redemptions_tenant_all" on public.offer_redemptions;
drop policy "offer_redemptions_admin_read" on public.offer_redemptions;
create policy "offer_redemptions_rw_select" on public.offer_redemptions for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))));
create policy "offer_redemptions_rw_insert" on public.offer_redemptions for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "offer_redemptions_rw_update" on public.offer_redemptions for update using ((tenant_id = ( SELECT auth.uid() AS uid))) with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "offer_redemptions_rw_delete" on public.offer_redemptions for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "passport_shares_owner_all" on public.passport_shares;
drop policy "passport_shares_landlord_read" on public.passport_shares;
create policy "passport_shares_rw_select" on public.passport_shares for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((landlord_id = ( SELECT auth.uid() AS uid))));
create policy "passport_shares_rw_insert" on public.passport_shares for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "passport_shares_rw_update" on public.passport_shares for update using ((tenant_id = ( SELECT auth.uid() AS uid))) with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "passport_shares_rw_delete" on public.passport_shares for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "tenant_areas_owner_all" on public.tenant_areas;
drop policy "tenant_areas_marketplace_read" on public.tenant_areas;
create policy "tenant_areas_rw_select" on public.tenant_areas for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.user_id = tenant_areas.tenant_id) AND ((t.passport_visibility = 'marketplace'::text) OR ((t.passport_visibility = 'applied_or_saved_only'::text) AND ((EXISTS ( SELECT 1
           FROM (applications a
             JOIN properties pr ON ((pr.id = a.property_id)))
          WHERE ((a.tenant_id = t.user_id) AND (pr.landlord_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
           FROM saved_tenants st
          WHERE ((st.tenant_id = t.user_id) AND (st.landlord_id = ( SELECT auth.uid() AS uid)))))))))))));
create policy "tenant_areas_rw_insert" on public.tenant_areas for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_areas_rw_update" on public.tenant_areas for update using ((tenant_id = ( SELECT auth.uid() AS uid))) with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_areas_rw_delete" on public.tenant_areas for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "tenant_interests_owner_all" on public.tenant_interests;
drop policy "tenant_interests_landlord_read" on public.tenant_interests;
create policy "tenant_interests_rw_select" on public.tenant_interests for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = tenant_interests.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))));
create policy "tenant_interests_rw_insert" on public.tenant_interests for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_interests_rw_update" on public.tenant_interests for update using ((tenant_id = ( SELECT auth.uid() AS uid))) with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_interests_rw_delete" on public.tenant_interests for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "tenant_plus_memberships_owner_all" on public.tenant_plus_memberships;
drop policy "tenant_plus_memberships_admin_read" on public.tenant_plus_memberships;
create policy "tenant_plus_memberships_rw_select" on public.tenant_plus_memberships for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))));
create policy "tenant_plus_memberships_rw_insert" on public.tenant_plus_memberships for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_plus_memberships_rw_update" on public.tenant_plus_memberships for update using ((tenant_id = ( SELECT auth.uid() AS uid))) with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_plus_memberships_rw_delete" on public.tenant_plus_memberships for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "properties_owner_all" on public.properties;
drop policy "properties_public_read_active" on public.properties;
create policy "properties_rw_select" on public.properties for select using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((status = 'active'::property_status)));
create policy "properties_rw_insert" on public.properties for insert with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "properties_rw_update" on public.properties for update using ((landlord_id = ( SELECT auth.uid() AS uid))) with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "properties_rw_delete" on public.properties for delete using ((landlord_id = ( SELECT auth.uid() AS uid)));

drop policy "property_photos_owner_all" on public.property_photos;
drop policy "property_photos_public_read" on public.property_photos;
create policy "property_photos_rw_select" on public.property_photos for select using (((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))) OR ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.status = 'active'::property_status))))));
create policy "property_photos_rw_insert" on public.property_photos for insert with check ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));
create policy "property_photos_rw_update" on public.property_photos for update using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));
create policy "property_photos_rw_delete" on public.property_photos for delete using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));

drop policy "rent_incentives_landlord_all" on public.rent_incentives;
drop policy "rent_incentives_admin_read" on public.rent_incentives;
drop policy "rent_incentives_public_read" on public.rent_incentives;
create policy "rent_incentives_rw_select" on public.rent_incentives for select using (((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((enabled AND (EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.status = 'active'::property_status)))))));
create policy "rent_incentives_rw_insert" on public.rent_incentives for insert with check ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));
create policy "rent_incentives_rw_update" on public.rent_incentives for update using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));
create policy "rent_incentives_rw_delete" on public.rent_incentives for delete using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))));

drop policy "payment_refunds_landlord_all" on public.payment_refunds;
drop policy "payment_refunds_admin_read" on public.payment_refunds;
drop policy "payment_refunds_tenant_read" on public.payment_refunds;
create policy "payment_refunds_rw_select" on public.payment_refunds for select using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));
create policy "payment_refunds_rw_insert" on public.payment_refunds for insert with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "payment_refunds_rw_update" on public.payment_refunds for update using ((landlord_id = ( SELECT auth.uid() AS uid))) with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "payment_refunds_rw_delete" on public.payment_refunds for delete using ((landlord_id = ( SELECT auth.uid() AS uid)));

drop policy "payment_verifications_landlord_all" on public.payment_verifications;
drop policy "payment_verifications_admin_read" on public.payment_verifications;
drop policy "payment_verifications_tenant_read" on public.payment_verifications;
create policy "payment_verifications_rw_select" on public.payment_verifications for select using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));
create policy "payment_verifications_rw_insert" on public.payment_verifications for insert with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "payment_verifications_rw_update" on public.payment_verifications for update using ((landlord_id = ( SELECT auth.uid() AS uid))) with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "payment_verifications_rw_delete" on public.payment_verifications for delete using ((landlord_id = ( SELECT auth.uid() AS uid)));

drop policy "ad_frequency_rules_admin_write" on public.ad_frequency_rules;
drop policy "ad_frequency_rules_public_read" on public.ad_frequency_rules;
create policy "ad_frequency_rules_rw_select" on public.ad_frequency_rules for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (true));
create policy "ad_frequency_rules_rw_insert" on public.ad_frequency_rules for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "ad_frequency_rules_rw_update" on public.ad_frequency_rules for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "ad_frequency_rules_rw_delete" on public.ad_frequency_rules for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "jurisdiction_rules_admin_write" on public.jurisdiction_rules;
drop policy "jurisdiction_rules_public_read" on public.jurisdiction_rules;
create policy "jurisdiction_rules_rw_select" on public.jurisdiction_rules for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (true));
create policy "jurisdiction_rules_rw_insert" on public.jurisdiction_rules for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "jurisdiction_rules_rw_update" on public.jurisdiction_rules for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "jurisdiction_rules_rw_delete" on public.jurisdiction_rules for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "perfect_pay_milestones_admin_write" on public.perfect_pay_milestones;
drop policy "perfect_pay_milestones_public_read" on public.perfect_pay_milestones;
create policy "perfect_pay_milestones_rw_select" on public.perfect_pay_milestones for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (true));
create policy "perfect_pay_milestones_rw_insert" on public.perfect_pay_milestones for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "perfect_pay_milestones_rw_update" on public.perfect_pay_milestones for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "perfect_pay_milestones_rw_delete" on public.perfect_pay_milestones for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "platform_fee_config_admin_write" on public.platform_fee_config;
drop policy "platform_fee_config_public_read" on public.platform_fee_config;
create policy "platform_fee_config_rw_select" on public.platform_fee_config for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (true));
create policy "platform_fee_config_rw_insert" on public.platform_fee_config for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "platform_fee_config_rw_update" on public.platform_fee_config for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "platform_fee_config_rw_delete" on public.platform_fee_config for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "ad_packages_admin_write" on public.ad_packages;
drop policy "ad_packages_public_read" on public.ad_packages;
create policy "ad_packages_rw_select" on public.ad_packages for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (active));
create policy "ad_packages_rw_insert" on public.ad_packages for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "ad_packages_rw_update" on public.ad_packages for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "ad_packages_rw_delete" on public.ad_packages for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "partner_offers_admin_write" on public.partner_offers;
drop policy "partner_offers_public_read" on public.partner_offers;
create policy "partner_offers_rw_select" on public.partner_offers for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (active));
create policy "partner_offers_rw_insert" on public.partner_offers for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "partner_offers_rw_update" on public.partner_offers for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "partner_offers_rw_delete" on public.partner_offers for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "perfect_partners_admin_write" on public.perfect_partners;
drop policy "perfect_partners_public_read" on public.perfect_partners;
create policy "perfect_partners_rw_select" on public.perfect_partners for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (active));
create policy "perfect_partners_rw_insert" on public.perfect_partners for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "perfect_partners_rw_update" on public.perfect_partners for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "perfect_partners_rw_delete" on public.perfect_partners for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "subscription_plans_admin_write" on public.subscription_plans;
drop policy "subscription_plans_public_read" on public.subscription_plans;
create policy "subscription_plans_rw_select" on public.subscription_plans for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR (active));
create policy "subscription_plans_rw_insert" on public.subscription_plans for insert with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "subscription_plans_rw_update" on public.subscription_plans for update using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));
create policy "subscription_plans_rw_delete" on public.subscription_plans for delete using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin))));

drop policy "ad_clicks_admin_read" on public.ad_clicks;
drop policy "ad_clicks_owner_read" on public.ad_clicks;
create policy "ad_clicks_select_combined" on public.ad_clicks for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_clicks.campaign_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));

drop policy "ad_impressions_admin_read" on public.ad_impressions;
drop policy "ad_impressions_owner_read" on public.ad_impressions;
create policy "ad_impressions_select_combined" on public.ad_impressions for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_impressions.campaign_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));

drop policy "ad_revenue_events_admin_read" on public.ad_revenue_events;
drop policy "ad_revenue_events_owner_read" on public.ad_revenue_events;
create policy "ad_revenue_events_select_combined" on public.ad_revenue_events for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_revenue_events.campaign_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));

drop policy "passport_views_landlord_read" on public.passport_views;
drop policy "passport_views_tenant_read" on public.passport_views;
create policy "passport_views_select_combined" on public.passport_views for select using (((viewer_landlord_id = ( SELECT auth.uid() AS uid))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));

drop policy "reward_events_admin_read" on public.reward_events;
drop policy "reward_events_tenant_read" on public.reward_events;
create policy "reward_events_select_combined" on public.reward_events for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));

drop policy "verified_purchases_admin_read" on public.verified_purchases;
drop policy "verified_purchases_owner_read" on public.verified_purchases;
create policy "verified_purchases_select_combined" on public.verified_purchases for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));

drop policy "ad_campaigns_admin_all" on public.ad_campaigns;
drop policy "ad_campaigns_owner_all" on public.ad_campaigns;
drop policy "ad_campaigns_public_read_active" on public.ad_campaigns;
create policy "ad_campaigns_select_combined" on public.ad_campaigns for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))) OR (((status = 'approved'::campaign_status) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now())))));
create policy "ad_campaigns_insert_combined" on public.ad_campaigns for insert with check (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));
create policy "ad_campaigns_update_combined" on public.ad_campaigns for update using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid))))))) with check (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));
create policy "ad_campaigns_delete_combined" on public.ad_campaigns for delete using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( SELECT auth.uid() AS uid)))))));

drop policy "advertisers_admin_all" on public.advertisers;
drop policy "advertisers_owner_all" on public.advertisers;
create policy "advertisers_select_combined" on public.advertisers for select using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((owner_landlord_id = ( SELECT auth.uid() AS uid))));
create policy "advertisers_insert_combined" on public.advertisers for insert with check (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((owner_landlord_id = ( SELECT auth.uid() AS uid))));
create policy "advertisers_update_combined" on public.advertisers for update using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((owner_landlord_id = ( SELECT auth.uid() AS uid)))) with check (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((owner_landlord_id = ( SELECT auth.uid() AS uid))));
create policy "advertisers_delete_combined" on public.advertisers for delete using (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND u.is_admin)))) OR ((owner_landlord_id = ( SELECT auth.uid() AS uid))));

drop policy "applications_tenant_all" on public.applications;
drop policy "applications_landlord_read" on public.applications;
drop policy "applications_landlord_update_status" on public.applications;
create policy "applications_select_combined" on public.applications for select using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = applications.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))));
create policy "applications_insert_tenant" on public.applications for insert with check ((tenant_id = ( SELECT auth.uid() AS uid)));
create policy "applications_update_combined" on public.applications for update using (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = applications.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid))))))) with check (((tenant_id = ( SELECT auth.uid() AS uid))) OR ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = applications.property_id) AND (p.landlord_id = ( SELECT auth.uid() AS uid)))))));
create policy "applications_delete_tenant" on public.applications for delete using ((tenant_id = ( SELECT auth.uid() AS uid)));

drop policy "tenant_invitations_landlord_all" on public.tenant_invitations;
drop policy "tenant_invitations_tenant_read" on public.tenant_invitations;
drop policy "tenant_invitations_tenant_respond" on public.tenant_invitations;
create policy "tenant_invitations_select_combined" on public.tenant_invitations for select using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));
create policy "tenant_invitations_insert_landlord" on public.tenant_invitations for insert with check ((landlord_id = ( SELECT auth.uid() AS uid)));
create policy "tenant_invitations_update_combined" on public.tenant_invitations for update using (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((tenant_id = ( SELECT auth.uid() AS uid)))) with check (((landlord_id = ( SELECT auth.uid() AS uid))) OR ((tenant_id = ( SELECT auth.uid() AS uid))));
create policy "tenant_invitations_delete_landlord" on public.tenant_invitations for delete using ((landlord_id = ( SELECT auth.uid() AS uid)));
