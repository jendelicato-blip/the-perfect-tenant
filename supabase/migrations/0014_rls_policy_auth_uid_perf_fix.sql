-- Performance fix flagged by Supabase's advisor (auth_rls_initplan): each of these
-- policies called auth.uid() directly, which Postgres re-evaluates once per row
-- scanned. Wrapping it as (select auth.uid()) lets the planner evaluate it once
-- per query (it becomes a stable sub-select the optimizer can cache), with zero
-- change in which rows are visible -- purely a query-planning fix, semantics identical.
--
-- Applied directly to the live project on 2026-09-08 (see chat history); this file
-- brings the repo's migration history back in sync with what's already live.

alter policy "ad_campaigns_admin_all" on public.ad_campaigns using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_campaigns_owner_all" on public.ad_campaigns using ((EXISTS ( SELECT 1
   FROM advertisers a
  WHERE ((a.id = ad_campaigns.advertiser_id) AND (a.owner_landlord_id = ( select auth.uid() ))))));
alter policy "ad_clicks_admin_read" on public.ad_clicks using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_clicks_owner_read" on public.ad_clicks using ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_clicks.campaign_id) AND (a.owner_landlord_id = ( select auth.uid() ))))));
alter policy "ad_frequency_rules_admin_write" on public.ad_frequency_rules using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_impressions_admin_read" on public.ad_impressions using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_impressions_owner_read" on public.ad_impressions using ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_impressions.campaign_id) AND (a.owner_landlord_id = ( select auth.uid() ))))));
alter policy "ad_packages_admin_write" on public.ad_packages using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_revenue_events_admin_read" on public.ad_revenue_events using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_revenue_events_insert_admin" on public.ad_revenue_events with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "ad_revenue_events_owner_read" on public.ad_revenue_events using ((EXISTS ( SELECT 1
   FROM (ad_campaigns c
     JOIN advertisers a ON ((a.id = c.advertiser_id)))
  WHERE ((c.id = ad_revenue_events.campaign_id) AND (a.owner_landlord_id = ( select auth.uid() ))))));
alter policy "advertisers_admin_all" on public.advertisers using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "advertisers_owner_all" on public.advertisers using ((owner_landlord_id = ( select auth.uid() )));
alter policy "applications_landlord_read" on public.applications using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = applications.property_id) AND (p.landlord_id = ( select auth.uid() ))))));
alter policy "applications_landlord_update_status" on public.applications using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = applications.property_id) AND (p.landlord_id = ( select auth.uid() ))))));
alter policy "applications_tenant_all" on public.applications using ((tenant_id = ( select auth.uid() )));
alter policy "audit_logs_owner_read" on public.audit_logs using ((user_id = ( select auth.uid() )));
alter policy "background_screenings_owner_all" on public.background_screenings using ((tenant_id = ( select auth.uid() )));
alter policy "conversations_participant_all" on public.conversations using (((tenant_id = ( select auth.uid() )) OR (landlord_id = ( select auth.uid() ))));
alter policy "credit_screenings_owner_all" on public.credit_screenings using ((tenant_id = ( select auth.uid() )));
alter policy "disputes_participant_read" on public.disputes using (((reporter_id = ( select auth.uid() )) OR (subject_id = ( select auth.uid() ))));
alter policy "disputes_reporter_insert" on public.disputes with check ((reporter_id = ( select auth.uid() )));
alter policy "disputes_subject_update" on public.disputes using ((subject_id = ( select auth.uid() ))) with check ((subject_id = ( select auth.uid() )));
alter policy "employment_owner_all" on public.employment using ((tenant_id = ( select auth.uid() )));
alter policy "eviction_screenings_owner_all" on public.eviction_screenings using ((tenant_id = ( select auth.uid() )));
alter policy "identity_verification_owner_all" on public.identity_verification using ((tenant_id = ( select auth.uid() )));
alter policy "income_verification_owner_all" on public.income_verification using ((tenant_id = ( select auth.uid() )));
alter policy "jurisdiction_rules_admin_write" on public.jurisdiction_rules using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "landlord_payout_accounts_admin_read" on public.landlord_payout_accounts using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "landlord_payout_accounts_owner" on public.landlord_payout_accounts using ((landlord_id = ( select auth.uid() )));
alter policy "landlord_reviews_tenant_insert" on public.landlord_reviews with check (((tenant_id = ( select auth.uid() )) AND (EXISTS ( SELECT 1
   FROM applications a
  WHERE ((a.tenant_id = ( select auth.uid() )) AND (a.property_id = landlord_reviews.property_id) AND (a.status = 'approved'::application_status))))));
alter policy "landlords_owner_all" on public.landlords using ((user_id = ( select auth.uid() )));
alter policy "messages_participant_insert" on public.messages with check (((sender_id = ( select auth.uid() )) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.tenant_id = ( select auth.uid() )) OR (c.landlord_id = ( select auth.uid() ))))))));
alter policy "messages_participant_read" on public.messages using ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.tenant_id = ( select auth.uid() )) OR (c.landlord_id = ( select auth.uid() )))))));
alter policy "notifications_owner_read" on public.notifications using ((user_id = ( select auth.uid() )));
alter policy "notifications_owner_update" on public.notifications using ((user_id = ( select auth.uid() )));
alter policy "offer_redemptions_admin_read" on public.offer_redemptions using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "offer_redemptions_tenant_all" on public.offer_redemptions using ((tenant_id = ( select auth.uid() )));
alter policy "partner_offers_admin_write" on public.partner_offers using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "passport_shares_landlord_read" on public.passport_shares using ((landlord_id = ( select auth.uid() )));
alter policy "passport_shares_owner_all" on public.passport_shares using ((tenant_id = ( select auth.uid() )));
alter policy "passport_views_landlord_insert" on public.passport_views with check ((viewer_landlord_id = ( select auth.uid() )));
alter policy "passport_views_landlord_read" on public.passport_views using ((viewer_landlord_id = ( select auth.uid() )));
alter policy "passport_views_tenant_read" on public.passport_views using ((tenant_id = ( select auth.uid() )));
alter policy "payment_refunds_admin_read" on public.payment_refunds using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "payment_refunds_landlord_all" on public.payment_refunds using ((landlord_id = ( select auth.uid() )));
alter policy "payment_refunds_tenant_read" on public.payment_refunds using ((tenant_id = ( select auth.uid() )));
alter policy "payment_verifications_admin_read" on public.payment_verifications using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "payment_verifications_landlord_all" on public.payment_verifications using ((landlord_id = ( select auth.uid() )));
alter policy "payment_verifications_tenant_read" on public.payment_verifications using ((tenant_id = ( select auth.uid() )));
alter policy "perfect_partners_admin_write" on public.perfect_partners using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "perfect_pay_milestones_admin_write" on public.perfect_pay_milestones using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "platform_fee_config_admin_write" on public.platform_fee_config using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "plus_membership_config_admin_write" on public.plus_membership_config using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "properties_owner_all" on public.properties using ((landlord_id = ( select auth.uid() )));
alter policy "property_photos_owner_all" on public.property_photos using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_photos.property_id) AND (p.landlord_id = ( select auth.uid() ))))));
alter policy "rent_incentives_admin_read" on public.rent_incentives using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "rent_incentives_landlord_all" on public.rent_incentives using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = rent_incentives.property_id) AND (p.landlord_id = ( select auth.uid() ))))));
alter policy "rental_history_owner_all" on public.rental_history using ((tenant_id = ( select auth.uid() )));
alter policy "reward_events_admin_read" on public.reward_events using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "reward_events_insert" on public.reward_events with check (((tenant_id = ( select auth.uid() )) OR (EXISTS ( SELECT 1
   FROM payment_verifications pv
  WHERE ((pv.tenant_id = reward_events.tenant_id) AND (pv.landlord_id = ( select auth.uid() )))))));
alter policy "reward_events_tenant_read" on public.reward_events using ((tenant_id = ( select auth.uid() )));
alter policy "saved_properties_owner_all" on public.saved_properties using ((tenant_id = ( select auth.uid() )));
alter policy "saved_tenants_owner_all" on public.saved_tenants using ((landlord_id = ( select auth.uid() )));
alter policy "subscription_plans_admin_write" on public.subscription_plans using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "subscriptions_owner_all" on public.subscriptions using ((landlord_id = ( select auth.uid() )));
alter policy "tenant_areas_marketplace_read" on public.tenant_areas using ((EXISTS ( SELECT 1
   FROM tenants t
  WHERE ((t.user_id = tenant_areas.tenant_id) AND ((t.passport_visibility = 'marketplace'::text) OR ((t.passport_visibility = 'applied_or_saved_only'::text) AND ((EXISTS ( SELECT 1
           FROM (applications a
             JOIN properties pr ON ((pr.id = a.property_id)))
          WHERE ((a.tenant_id = t.user_id) AND (pr.landlord_id = ( select auth.uid() ))))) OR (EXISTS ( SELECT 1
           FROM saved_tenants st
          WHERE ((st.tenant_id = t.user_id) AND (st.landlord_id = ( select auth.uid() ))))))))))));
alter policy "tenant_areas_owner_all" on public.tenant_areas using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_documents_owner_all" on public.tenant_documents using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_interests_landlord_read" on public.tenant_interests using ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = tenant_interests.property_id) AND (p.landlord_id = ( select auth.uid() ))))));
alter policy "tenant_interests_owner_all" on public.tenant_interests using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_invitations_landlord_all" on public.tenant_invitations using ((landlord_id = ( select auth.uid() )));
alter policy "tenant_invitations_tenant_read" on public.tenant_invitations using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_invitations_tenant_respond" on public.tenant_invitations using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_matches_owner_read" on public.tenant_matches using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_pets_owner_all" on public.tenant_pets using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_plus_memberships_admin_read" on public.tenant_plus_memberships using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "tenant_plus_memberships_owner_all" on public.tenant_plus_memberships using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_preferences_owner_all" on public.tenant_preferences using ((tenant_id = ( select auth.uid() )));
alter policy "tenant_references_owner_all" on public.tenant_references using ((tenant_id = ( select auth.uid() )));
alter policy "tenants_owner_all" on public.tenants using ((user_id = ( select auth.uid() )));
alter policy "users_select_self" on public.users using ((id = ( select auth.uid() )));
alter policy "users_update_self" on public.users using ((id = ( select auth.uid() )));
alter policy "verified_purchases_admin_read" on public.verified_purchases using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "verified_purchases_owner_insert" on public.verified_purchases with check ((tenant_id = ( select auth.uid() )));
alter policy "verified_purchases_owner_read" on public.verified_purchases using ((tenant_id = ( select auth.uid() )));
alter policy "verified_tier_config_admin_write" on public.verified_tier_config using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
alter policy "webhook_events_admin_read" on public.webhook_events using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( select auth.uid() )) AND u.is_admin))));
