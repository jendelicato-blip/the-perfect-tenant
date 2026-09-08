-- Performance fix flagged by Supabase's advisor (unindexed_foreign_keys): these FK
-- columns had no covering index, which forces a sequential scan on the child table
-- for every parent-row update/delete (FK constraint checks) and for any query joining
-- through them. IF NOT EXISTS makes this safe to re-run.
--
-- Applied directly to the live project on 2026-09-08 (see chat history); this file
-- brings the repo's migration history back in sync with what's already live.

create index if not exists idx_ad_campaigns_advertiser_id on public.ad_campaigns (advertiser_id);
create index if not exists idx_ad_campaigns_landlord_id on public.ad_campaigns (landlord_id);
create index if not exists idx_ad_campaigns_package_id on public.ad_campaigns (package_id);
create index if not exists idx_ad_campaigns_property_id on public.ad_campaigns (property_id);
create index if not exists idx_ad_clicks_campaign_id on public.ad_clicks (campaign_id);
create index if not exists idx_ad_clicks_offer_id on public.ad_clicks (offer_id);
create index if not exists idx_ad_impressions_campaign_id on public.ad_impressions (campaign_id);
create index if not exists idx_ad_impressions_offer_id on public.ad_impressions (offer_id);
create index if not exists idx_ad_revenue_events_campaign_id on public.ad_revenue_events (campaign_id);
create index if not exists idx_advertisers_owner_landlord_id on public.advertisers (owner_landlord_id);
create index if not exists idx_applications_property_id on public.applications (property_id);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);
create index if not exists idx_conversations_landlord_id on public.conversations (landlord_id);
create index if not exists idx_conversations_property_id on public.conversations (property_id);
create index if not exists idx_conversations_tenant_id on public.conversations (tenant_id);
create index if not exists idx_disputes_payment_verification_id on public.disputes (payment_verification_id);
create index if not exists idx_disputes_reporter_id on public.disputes (reporter_id);
create index if not exists idx_disputes_subject_id on public.disputes (subject_id);
create index if not exists idx_landlord_reviews_property_id on public.landlord_reviews (property_id);
create index if not exists idx_landlord_reviews_tenant_id on public.landlord_reviews (tenant_id);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_offer_redemptions_tenant_id on public.offer_redemptions (tenant_id);
create index if not exists idx_partner_offers_partner_id on public.partner_offers (partner_id);
create index if not exists idx_passport_shares_landlord_id on public.passport_shares (landlord_id);
create index if not exists idx_passport_shares_tenant_id on public.passport_shares (tenant_id);
create index if not exists idx_passport_views_tenant_id on public.passport_views (tenant_id);
create index if not exists idx_passport_views_viewer_landlord_id on public.passport_views (viewer_landlord_id);
create index if not exists idx_payment_refunds_landlord_id on public.payment_refunds (landlord_id);
create index if not exists idx_payment_refunds_payment_verification_id on public.payment_refunds (payment_verification_id);
create index if not exists idx_payment_refunds_tenant_id on public.payment_refunds (tenant_id);
create index if not exists idx_payment_verifications_landlord_id on public.payment_verifications (landlord_id);
create index if not exists idx_payment_verifications_property_id on public.payment_verifications (property_id);
create index if not exists idx_perfect_partners_advertiser_id on public.perfect_partners (advertiser_id);
create index if not exists idx_properties_landlord_id on public.properties (landlord_id);
create index if not exists idx_property_photos_property_id on public.property_photos (property_id);
create index if not exists idx_rental_history_tenant_id on public.rental_history (tenant_id);
create index if not exists idx_reward_events_tenant_id on public.reward_events (tenant_id);
create index if not exists idx_saved_properties_property_id on public.saved_properties (property_id);
create index if not exists idx_saved_tenants_tenant_id on public.saved_tenants (tenant_id);
create index if not exists idx_tenant_areas_tenant_id on public.tenant_areas (tenant_id);
create index if not exists idx_tenant_interests_property_id on public.tenant_interests (property_id);
create index if not exists idx_tenant_invitations_landlord_id on public.tenant_invitations (landlord_id);
create index if not exists idx_tenant_invitations_property_id on public.tenant_invitations (property_id);
create index if not exists idx_tenant_invitations_tenant_id on public.tenant_invitations (tenant_id);
create index if not exists idx_tenant_matches_property_id on public.tenant_matches (property_id);
create index if not exists idx_tenant_pets_tenant_id on public.tenant_pets (tenant_id);
create index if not exists idx_tenant_references_tenant_id on public.tenant_references (tenant_id);
