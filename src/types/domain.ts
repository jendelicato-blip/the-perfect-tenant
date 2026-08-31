// Domain types mirroring supabase/migrations/0001_init.sql 1:1, so the data
// layer can swap between local seed data and a live Supabase project with no
// changes to the UI.

export type Role = "tenant" | "landlord";

export type VerificationStatus = "not_started" | "pending" | "verified" | "failed" | "expired";

export interface User {
  id: string;
  email: string;
  role: Role;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
}

export type PassportVisibility = "marketplace" | "applied_or_saved_only" | "private";

export interface Tenant {
  user_id: string;
  intro_text: string | null;
  photo_url: string | null;
  household_size: number;
  lease_pref_months: number | null;
  passport_visibility: PassportVisibility;
  auto_payment_enrolled: boolean;
}

export type PropertyType = "apartment" | "house" | "condo" | "townhouse" | "studio";

export interface TenantPreferences {
  tenant_id: string;
  min_rent: number;
  max_rent: number;
  beds: number;
  baths: number;
  property_types: PropertyType[];
  move_in_date: string;
  pets: boolean;
  parking_required: boolean;
  desired_amenities: string[];
}

export interface TenantArea {
  id: string;
  tenant_id: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  radius_miles: number;
}

export interface TenantPet {
  id: string;
  tenant_id: string;
  type: string;
  breed: string | null;
  weight: number | null;
}

export interface Employment {
  tenant_id: string;
  employer: string | null;
  title: string | null;
  status: VerificationStatus;
  provider: string | null;
  verified_at: string | null;
  expires_at: string | null;
}

export interface IncomeVerification {
  tenant_id: string;
  monthly_income_range: string | null;
  status: VerificationStatus;
  provider: string | null;
  verified_at: string | null;
  expires_at: string | null;
}

export interface IdentityVerification {
  tenant_id: string;
  status: VerificationStatus;
  provider: string | null;
  verified_at: string | null;
  expires_at: string | null;
}

export interface RentalHistoryEntry {
  id: string;
  tenant_id: string;
  prior_address: string;
  landlord_contact: string | null;
  status: VerificationStatus;
  verified_at: string | null;
}

export interface TenantReference {
  id: string;
  tenant_id: string;
  name: string;
  relationship: string;
  contact: string | null;
  status: VerificationStatus;
}

export interface CreditScreening {
  tenant_id: string;
  status: VerificationStatus;
  provider: string | null;
  report_ref: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

export interface BackgroundScreening {
  tenant_id: string;
  status: VerificationStatus;
  provider: string | null;
  report_ref: string | null;
  completed_at: string | null;
}

export interface EvictionScreening {
  tenant_id: string;
  status: VerificationStatus;
  provider: string | null;
  completed_at: string | null;
}

export type SubscriptionTier = "starter" | "growth" | "portfolio";

export interface Landlord {
  user_id: string;
  company_name: string | null;
  subscription_tier: SubscriptionTier;
  identity_verified: boolean;
  contact_verified: boolean;
  business_verified: boolean;
  verified_at: string | null;
}

export const isVerifiedLandlord = (l: Pick<Landlord, "identity_verified" | "contact_verified" | "business_verified">): boolean =>
  l.identity_verified && l.contact_verified && l.business_verified;

export type PropertyStatus = "draft" | "active" | "paused" | "leased";

export interface Property {
  id: string;
  landlord_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  rent: number;
  deposit: number;
  beds: number;
  baths: number;
  sqft: number | null;
  type: PropertyType;
  available_date: string;
  lease_term_months: number;
  pet_policy: "no_pets" | "cats_only" | "dogs_only" | "cats_and_dogs" | "case_by_case";
  amenities: string[];
  description: string;
  status: PropertyStatus;
  created_at: string;
}

export function propertyHasParking(property: Pick<Property, "amenities">): boolean {
  return property.amenities.some((a) => /parking|garage/i.test(a));
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  url: string;
  sort_order: number;
}

export interface TenantMatch {
  tenant_id: string;
  property_id: string;
  score: number;
  reasons: MatchReason[];
  created_at: string;
}

export interface MatchReason {
  label: string;
  weight: number;
  matched: boolean;
}

export type ApplicationStatus =
  | "submitted"
  | "reviewing"
  | "approved"
  | "declined"
  | "withdrawn";

export interface Application {
  id: string;
  tenant_id: string;
  property_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  landlord_id: string;
  property_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
  read_at: string | null;
}

export interface SavedProperty {
  tenant_id: string;
  property_id: string;
  created_at: string;
}

export interface SavedTenant {
  landlord_id: string;
  tenant_id: string;
  created_at: string;
}

export interface Subscription {
  landlord_id: string;
  tier: SubscriptionTier;
  stripe_customer_id: string | null;
  status: "active" | "trialing" | "past_due" | "canceled";
  renews_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_table: string;
  target_id: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  reporter_id: string;
  subject_id: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
}

// ---------- Perfect10ant Passport™ / two-sided marketplace ----------

export type InvitationStatus = "sent" | "accepted" | "declined";

export interface TenantInvitation {
  id: string;
  landlord_id: string;
  tenant_id: string;
  property_id: string;
  status: InvitationStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface TenantInterest {
  tenant_id: string;
  property_id: string;
  created_at: string;
}

export interface PassportShare {
  id: string;
  tenant_id: string;
  landlord_id: string | null;
  share_token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface PassportView {
  id: string;
  tenant_id: string;
  viewer_landlord_id: string;
  viewed_at: string;
}

export interface LandlordReview {
  id: string;
  landlord_id: string;
  tenant_id: string;
  property_id: string | null;
  communication_rating: number;
  maintenance_rating: number;
  accuracy_rating: number;
  professionalism_rating: number;
  move_in_rating: number;
  overall_rating: number;
  comment: string | null;
  created_at: string;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price_cents: number;
  billing_period: string;
  features: string[];
  active: boolean;
  updated_at: string;
}

// "Rental Ready" is never stored — it's always derived from the current
// verification statuses below, the same list the Passport / Verification
// Center display. Keeping it derived (not a cached column) means it can
// never drift from the underlying verification data.
export type RentalReadyLevel = "rental_ready" | "almost_ready" | "action_required";

export interface RentalReadyResult {
  level: RentalReadyLevel;
  completed: number;
  total: number;
  nextStep: string | null;
}

export const REQUIRED_VERIFICATIONS: { key: keyof TenantVerificationSummary; label: string }[] = [
  { key: "identity", label: "identity verification" },
  { key: "income", label: "income verification" },
  { key: "employment", label: "employment verification" },
  { key: "rentalHistory", label: "rental history verification" },
  { key: "credit", label: "credit screening" },
  { key: "background", label: "background screening" },
  { key: "eviction", label: "eviction search" },
  { key: "references", label: "references" },
];

export interface TenantVerificationSummary {
  identity: VerificationStatus;
  income: VerificationStatus;
  employment: VerificationStatus;
  rentalHistory: VerificationStatus;
  credit: VerificationStatus;
  background: VerificationStatus;
  eviction: VerificationStatus;
  references: VerificationStatus;
}

export function computeRentalReady(v: TenantVerificationSummary): RentalReadyResult {
  const total = REQUIRED_VERIFICATIONS.length;
  const completed = REQUIRED_VERIFICATIONS.filter((r) => v[r.key] === "verified").length;
  const failedOrExpired = REQUIRED_VERIFICATIONS.find((r) => v[r.key] === "failed" || v[r.key] === "expired");
  const nextIncomplete = REQUIRED_VERIFICATIONS.find((r) => v[r.key] !== "verified");

  if (completed === total) {
    return { level: "rental_ready", completed, total, nextStep: null };
  }
  if (failedOrExpired) {
    return {
      level: "action_required",
      completed,
      total,
      nextStep: `Resolve your ${failedOrExpired.label} to continue toward Rental Ready.`,
    };
  }
  return {
    level: "almost_ready",
    completed,
    total,
    nextStep: nextIncomplete ? `Complete ${nextIncomplete.label} to become Rental Ready.` : null,
  };
}

// Composite view types used by the UI (never expose verification base tables
// directly to a landlord-facing client — this is the shape the "safe view"
// RLS policies in the migration are designed to produce).
export interface TenantSummary {
  tenant: Tenant;
  user: Pick<User, "id" | "email">;
  preferences: TenantPreferences;
  areas: TenantArea[];
  verification: TenantVerificationSummary;
}

// The tenant's own Verification Center / Passport needs the full detail
// (provider, dates) behind each status — never exposed to landlords, who
// only ever see TenantVerificationSummary's bare statuses via the
// tenant_public_profile view. RLS on the underlying tables (tenant_id =
// auth.uid() only) is what actually enforces that, not this type.
export interface VerificationDetail {
  status: VerificationStatus;
  provider: string | null;
  verified_at: string | null;
  expires_at: string | null;
}

export interface TenantVerificationDetails {
  identity: VerificationDetail;
  income: VerificationDetail & { monthly_income_range: string | null };
  employment: VerificationDetail & { employer: string | null; title: string | null };
  credit: VerificationDetail;
  background: VerificationDetail;
  eviction: VerificationDetail;
  rentalHistory: RentalHistoryEntry[];
  references: TenantReference[];
}

export interface PropertyWithPhotos extends Property {
  photos: PropertyPhoto[];
}

// ---------- Perfect Rent™ / Perfect Pay™ / Perfect Rewards™ ----------
//
// Deliberately not modeled here: security deposits or prepaid-rent
// incentives (jurisdiction-dependent, needs real legal review first — see
// JurisdictionRule, which is a permissive compliance stub, not real legal
// data) and a real payment-processor integration (Perfect Pay is backed
// only by landlord-confirmed payments in Phase 1 — see PaymentVerification).

export type IncentiveType = "passport_verified" | "longer_lease" | "auto_payment" | "rental_history" | "upfront_rent";

export const INCENTIVE_LABELS: Record<IncentiveType, string> = {
  passport_verified: "Perfect10ant Passport discount",
  longer_lease: "Longer-lease discount",
  auto_payment: "Automatic payment discount",
  rental_history: "Verified rental history discount",
  upfront_rent: "Qualifying upfront-rent arrangement",
};

export interface RentIncentive {
  id: string;
  property_id: string;
  type: IncentiveType;
  discount_cents: number;
  enabled: boolean;
  requires_lease_months: number | null;
  created_at: string;
  updated_at: string;
}

export interface JurisdictionRule {
  id: string;
  state: string;
  incentive_type: IncentiveType;
  allowed: boolean;
  note: string | null;
  updated_at: string;
}

export type PaymentStatus = "on_time" | "late" | "disputed";

export interface PaymentVerification {
  id: string;
  tenant_id: string;
  property_id: string;
  landlord_id: string;
  period_start: string;
  status: PaymentStatus;
  verified_by: string;
  verified_at: string;
}

export type PerfectPayLevel = "new" | "bronze" | "silver" | "gold" | "platinum";

export interface PerfectPayMilestone {
  level: PerfectPayLevel;
  consecutive_payments_required: number;
  sort_order: number;
}

export interface RewardEvent {
  id: string;
  tenant_id: string;
  type: string;
  body: string;
  created_at: string;
}

// Streak = consecutive on-time payments counting back from the most recent
// period, stopping at the first late/disputed payment or gap. A tenant with
// zero verified payments yet has streak 0 (Perfect Pay — New).
export function computeOnTimeStreak(payments: Pick<PaymentVerification, "period_start" | "status">[]): number {
  const sorted = [...payments].sort((a, b) => b.period_start.localeCompare(a.period_start));
  let streak = 0;
  for (const p of sorted) {
    if (p.status !== "on_time") break;
    streak += 1;
  }
  return streak;
}

export interface PerfectPayResult {
  level: PerfectPayLevel;
  streak: number;
  next: PerfectPayMilestone | null;
}

export function computePerfectPayLevel(streak: number, milestones: PerfectPayMilestone[]): PerfectPayResult {
  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order);
  let current = sorted[0] ?? { level: "new" as const, consecutive_payments_required: 0, sort_order: 0 };
  for (const m of sorted) {
    if (streak >= m.consecutive_payments_required) current = m;
  }
  const next = sorted.find((m) => m.sort_order > current.sort_order) ?? null;
  return { level: current.level, streak, next };
}

// ---------- Perfect Partners™ (advertising & monetization) ----------
//
// Core rule, enforced structurally, not just by convention: paid placement
// can only ever change VISIBILITY (position, "Sponsored" labeling) — never
// the Perfect Match™ score. Nothing below is written by scoreMatch(), and
// no field here targets a protected characteristic: only geography
// (city/state/zip/radius) and campaign category exist to target on.
// Deliberately not modeled: a separate third-party advertiser signup role
// (Phase 1 only supports a landlord promoting their own property, plus
// admin-managed Perfect Partners — see docs/ARCHITECTURE.md) and real
// advertiser billing (approving a campaign records a real revenue event
// from a real configured package price, but no card is ever charged).

export type AdCategory = "real_estate" | "moving" | "home_services" | "financial_insurance" | "utilities" | "home_products";

export const AD_CATEGORY_LABELS: Record<AdCategory, string> = {
  real_estate: "Real Estate",
  moving: "Moving",
  home_services: "Home Services",
  financial_insurance: "Financial / Insurance",
  utilities: "Utilities",
  home_products: "Home Products",
};

export type CampaignType = "sponsored_property" | "featured_landlord" | "perfect_partner" | "partner_deal";

export type CampaignStatus = "draft" | "pending_review" | "approved" | "rejected" | "paused" | "expired";

export interface Advertiser {
  id: string;
  name: string;
  category: AdCategory;
  website: string | null;
  contact_email: string | null;
  owner_landlord_id: string | null;
  verified_business: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface AdPackage {
  id: string;
  name: string;
  campaign_type: CampaignType;
  duration_days: number;
  price_cents: number;
  active: boolean;
  sort_order: number;
}

export interface AdCampaign {
  id: string;
  advertiser_id: string;
  campaign_type: CampaignType;
  status: CampaignStatus;
  property_id: string | null;
  landlord_id: string | null;
  package_id: string | null;
  target_city: string | null;
  target_state: string | null;
  target_zip: string | null;
  target_radius_miles: number | null;
  headline: string;
  description: string | null;
  offer_text: string | null;
  cta_label: string;
  destination_url: string | null;
  image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface PerfectPartner {
  id: string;
  advertiser_id: string | null;
  category: AdCategory;
  name: string;
  emoji: string;
  tagline: string | null;
  active: boolean;
  sort_order: number;
}

export interface PartnerOffer {
  id: string;
  partner_id: string;
  title: string;
  description: string;
  offer_text: string;
  promo_code: string | null;
  cta_label: string;
  destination_url: string | null;
  expires_at: string | null;
  active: boolean;
}

export interface OfferRedemption {
  id: string;
  offer_id: string;
  tenant_id: string;
  redeemed_at: string;
}

export interface AdImpression {
  id: string;
  campaign_id: string | null;
  offer_id: string | null;
  placement: string;
  occurred_at: string;
}

export interface AdClick {
  id: string;
  campaign_id: string | null;
  offer_id: string | null;
  placement: string;
  occurred_at: string;
}

export interface AdRevenueEvent {
  id: string;
  campaign_id: string;
  amount_cents: number;
  created_at: string;
}

// Singleton config row — "useful, relevant, never overwhelming" as an
// actual admin-editable ceiling, not just a design intention.
export interface AdFrequencyRules {
  max_sponsored_properties_per_page: number;
  max_partner_cards_per_page: number;
  ads_enabled: boolean;
}
