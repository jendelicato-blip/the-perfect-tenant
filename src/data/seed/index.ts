import type {
  AdCampaign,
  AdFrequencyRules,
  AdPackage,
  AdRevenueEvent,
  Advertiser,
  Application,
  BackgroundScreening,
  Conversation,
  CreditScreening,
  Employment,
  EvictionScreening,
  IdentityVerification,
  IncomeVerification,
  JurisdictionRule,
  Landlord,
  LandlordReview,
  Message,
  PartnerOffer,
  PassportShare,
  PassportView,
  PaymentVerification,
  PerfectPartner,
  PerfectPayMilestone,
  Property,
  PropertyPhoto,
  RentIncentive,
  RentalHistoryEntry,
  RewardEvent,
  SavedProperty,
  SavedTenant,
  Subscription,
  SubscriptionPlan,
  Tenant,
  TenantArea,
  TenantInterest,
  TenantInvitation,
  TenantPreferences,
  TenantReference,
  User,
} from "@/types/domain";

// Seed data used by the local dev-mode data layer (no Supabase project
// required to run the app). Shaped 1:1 against supabase/migrations/0001_*.sql
// so switching VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY to a live project needs
// no UI changes.

export const seedUsers: User[] = [
  { id: "u-tenant-1", email: "amara.tenant@example.com", role: "tenant", phone: "555-0101", is_admin: false, created_at: "2026-06-01T00:00:00Z" },
  { id: "u-tenant-2", email: "devon.tenant@example.com", role: "tenant", phone: "555-0102", is_admin: false, created_at: "2026-06-02T00:00:00Z" },
  // Priya doubles as the demo admin account (Admin dashboard / plan editor).
  { id: "u-landlord-1", email: "priya.landlord@example.com", role: "landlord", phone: "555-0201", is_admin: true, created_at: "2026-05-15T00:00:00Z" },
  { id: "u-landlord-2", email: "marcus.landlord@example.com", role: "landlord", phone: "555-0202", is_admin: false, created_at: "2026-05-20T00:00:00Z" },
];

export const seedTenants: Tenant[] = [
  { user_id: "u-tenant-1", intro_text: "Quiet grad student, works remote, tidy and reliable.", photo_url: null, household_size: 1, lease_pref_months: 12, passport_visibility: "marketplace", auto_payment_enrolled: true },
  { user_id: "u-tenant-2", intro_text: "Small family of three, looking for a long-term home near good schools.", photo_url: null, household_size: 3, lease_pref_months: 24, passport_visibility: "marketplace", auto_payment_enrolled: false },
];

export const seedTenantPreferences: TenantPreferences[] = [
  { tenant_id: "u-tenant-1", min_rent: 1200, max_rent: 1800, beds: 1, baths: 1, property_types: ["apartment", "studio"], move_in_date: "2026-10-01", pets: false, parking_required: false, desired_amenities: ["in-unit laundry"] },
  { tenant_id: "u-tenant-2", min_rent: 2000, max_rent: 2900, beds: 3, baths: 2, property_types: ["house", "townhouse"], move_in_date: "2026-11-15", pets: true, parking_required: true, desired_amenities: ["fenced yard", "garage"] },
];

export const seedTenantAreas: TenantArea[] = [
  { id: "ta-1", tenant_id: "u-tenant-1", city: "Omaha", zip: "68102", lat: 41.2565, lng: -95.9345, radius_miles: 8 },
  { id: "ta-2", tenant_id: "u-tenant-2", city: "Papillion", zip: "68046", lat: 41.1544, lng: -96.0422, radius_miles: 12 },
];

// Amara is fully Rental Ready (all 8 categories verified). Devon is Almost
// Ready — identity is pending and everything after it hasn't started, which
// is exactly the "here's what's missing" case the Passport should surface.

export const seedIdentityVerification: IdentityVerification[] = [
  { tenant_id: "u-tenant-1", status: "verified", provider: "Persona", verified_at: "2026-06-05T00:00:00Z", expires_at: "2027-06-05T00:00:00Z" },
  { tenant_id: "u-tenant-2", status: "pending", provider: "Persona", verified_at: null, expires_at: null },
];

export const seedIncomeVerification: IncomeVerification[] = [
  { tenant_id: "u-tenant-1", monthly_income_range: "$4,000-$5,000", status: "verified", provider: "Plaid Income", verified_at: "2026-06-05T00:00:00Z", expires_at: "2027-06-05T00:00:00Z" },
  { tenant_id: "u-tenant-2", monthly_income_range: "$6,000-$8,000", status: "not_started", provider: null, verified_at: null, expires_at: null },
];

export const seedEmployment: Employment[] = [
  { tenant_id: "u-tenant-1", employer: "Midlands Data Co.", title: "Software Engineer", status: "verified", provider: "The Work Number", verified_at: "2026-06-05T00:00:00Z", expires_at: "2027-06-05T00:00:00Z" },
  { tenant_id: "u-tenant-2", employer: null, title: null, status: "not_started", provider: null, verified_at: null, expires_at: null },
];

export const seedCreditScreenings: CreditScreening[] = [
  { tenant_id: "u-tenant-1", status: "verified", provider: "TransUnion SmartMove", report_ref: null, completed_at: "2026-06-06T00:00:00Z", expires_at: "2027-06-06T00:00:00Z" },
  { tenant_id: "u-tenant-2", status: "not_started", provider: null, report_ref: null, completed_at: null, expires_at: null },
];

export const seedBackgroundScreenings: BackgroundScreening[] = [
  { tenant_id: "u-tenant-1", status: "verified", provider: "TransUnion SmartMove", report_ref: null, completed_at: "2026-06-06T00:00:00Z" },
  { tenant_id: "u-tenant-2", status: "not_started", provider: null, report_ref: null, completed_at: null },
];

export const seedEvictionScreenings: EvictionScreening[] = [
  { tenant_id: "u-tenant-1", status: "verified", provider: "TransUnion SmartMove", completed_at: "2026-06-06T00:00:00Z" },
  { tenant_id: "u-tenant-2", status: "not_started", provider: null, completed_at: null },
];

export const seedRentalHistory: RentalHistoryEntry[] = [
  { id: "rh-1", tenant_id: "u-tenant-1", prior_address: "902 Leavenworth St, Omaha, NE", landlord_contact: "prior.landlord@example.com", status: "verified", verified_at: "2026-06-07T00:00:00Z" },
];

export const seedTenantReferences: TenantReference[] = [
  { id: "ref-1", tenant_id: "u-tenant-1", name: "Jordan Lee", relationship: "Former landlord", contact: "jordan.lee@example.com", status: "verified" },
];

export const seedLandlords: Landlord[] = [
  { user_id: "u-landlord-1", company_name: "Prairie Ridge Properties", subscription_tier: "growth", identity_verified: true, contact_verified: true, business_verified: true, verified_at: "2026-05-16T00:00:00Z" },
  { user_id: "u-landlord-2", company_name: "Marcus Rentals LLC", subscription_tier: "starter", identity_verified: true, contact_verified: false, business_verified: false, verified_at: null },
];

export const seedSubscriptions: Subscription[] = [
  { landlord_id: "u-landlord-1", tier: "growth", stripe_customer_id: null, status: "active", renews_at: "2026-09-30T00:00:00Z" },
  { landlord_id: "u-landlord-2", tier: "starter", stripe_customer_id: null, status: "trialing", renews_at: "2026-09-15T00:00:00Z" },
];

export const seedSubscriptionPlans: SubscriptionPlan[] = [
  { tier: "starter", name: "Starter", price_cents: 2900, billing_period: "month", features: ["1 active listing", "Basic match scoring", "Messaging"], active: true, updated_at: "2026-05-01T00:00:00Z" },
  { tier: "growth", name: "Growth", price_cents: 7900, billing_period: "month", features: ["10 active listings", "Priority match ranking", "Saved tenants", "Email support"], active: true, updated_at: "2026-05-01T00:00:00Z" },
  { tier: "portfolio", name: "Portfolio", price_cents: 19900, billing_period: "month", features: ["Unlimited listings", "Team seats", "Applicant analytics", "Priority support"], active: true, updated_at: "2026-05-01T00:00:00Z" },
];

export const seedProperties: Property[] = [
  {
    id: "p-1", landlord_id: "u-landlord-1", address: "412 Dodge St", city: "Omaha", state: "NE", zip: "68102",
    lat: 41.258, lng: -95.935, rent: 1450, deposit: 1450, beds: 1, baths: 1, sqft: 720, type: "apartment",
    available_date: "2026-10-01", lease_term_months: 12, pet_policy: "cats_only", amenities: ["in-unit laundry", "gym", "rooftop deck"],
    description: "Bright one-bedroom in the heart of downtown, walk to the riverfront.", status: "active",
    created_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "p-2", landlord_id: "u-landlord-1", address: "88 Capitol Ave", city: "Omaha", state: "NE", zip: "68114",
    lat: 41.264, lng: -96.005, rent: 1650, deposit: 1650, beds: 2, baths: 1, sqft: 950, type: "apartment",
    available_date: "2026-10-15", lease_term_months: 12, pet_policy: "no_pets", amenities: ["dishwasher", "covered parking"],
    description: "Spacious two-bedroom with updated kitchen, quiet building.", status: "active",
    created_at: "2026-08-02T00:00:00Z",
  },
  {
    id: "p-3", landlord_id: "u-landlord-2", address: "215 Maple Ridge Dr", city: "Papillion", state: "NE", zip: "68046",
    lat: 41.153, lng: -96.041, rent: 2400, deposit: 2400, beds: 3, baths: 2, sqft: 1850, type: "house",
    available_date: "2026-11-15", lease_term_months: 24, pet_policy: "cats_and_dogs", amenities: ["fenced yard", "garage", "central air"],
    description: "Family home near top-rated schools, fenced yard for pets and kids.", status: "active",
    created_at: "2026-08-03T00:00:00Z",
  },
  {
    id: "p-4", landlord_id: "u-landlord-2", address: "60 Orchard Ln", city: "Papillion", state: "NE", zip: "68046",
    lat: 41.148, lng: -96.038, rent: 2650, deposit: 2650, beds: 3, baths: 2, sqft: 2000, type: "townhouse",
    available_date: "2026-12-01", lease_term_months: 24, pet_policy: "case_by_case", amenities: ["garage", "community pool"],
    description: "Modern townhouse with community pool, close to shopping.", status: "active",
    created_at: "2026-08-05T00:00:00Z",
  },
  {
    id: "p-5", landlord_id: "u-landlord-1", address: "1200 Farnam St #3B", city: "Omaha", state: "NE", zip: "68102",
    lat: 41.256, lng: -95.933, rent: 1150, deposit: 1150, beds: 0, baths: 1, sqft: 480, type: "studio",
    available_date: "2026-09-20", lease_term_months: 12, pet_policy: "no_pets", amenities: ["in-unit laundry"],
    description: "Efficient studio steps from downtown restaurants and transit.", status: "active",
    created_at: "2026-08-06T00:00:00Z",
  },
];

export const seedPropertyPhotos: PropertyPhoto[] = [
  { id: "ph-1", property_id: "p-1", url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800", sort_order: 0 },
  { id: "ph-2", property_id: "p-2", url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800", sort_order: 0 },
  { id: "ph-3", property_id: "p-3", url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800", sort_order: 0 },
  { id: "ph-4", property_id: "p-4", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800", sort_order: 0 },
  { id: "ph-5", property_id: "p-5", url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800", sort_order: 0 },
];

export const seedApplications: Application[] = [
  // Approved (not just "reviewing") so the Perfect Pay payment history below,
  // and the tenant-review flow, both have a real approved tenancy behind them.
  { id: "app-1", tenant_id: "u-tenant-1", property_id: "p-1", status: "approved", created_at: "2026-08-10T00:00:00Z", updated_at: "2026-08-11T00:00:00Z" },
];

export const seedConversations: Conversation[] = [
  { id: "c-1", tenant_id: "u-tenant-1", landlord_id: "u-landlord-1", property_id: "p-1", created_at: "2026-08-10T00:00:00Z" },
];

export const seedMessages: Message[] = [
  { id: "m-1", conversation_id: "c-1", sender_id: "u-tenant-1", body: "Hi! Is 412 Dodge St still available for an Oct 1 move-in?", attachment_url: null, created_at: "2026-08-10T09:00:00Z", read_at: "2026-08-10T09:05:00Z" },
  { id: "m-2", conversation_id: "c-1", sender_id: "u-landlord-1", body: "Yes it is! I saw your application come through — everything looks great.", attachment_url: null, created_at: "2026-08-10T09:10:00Z", read_at: null },
];

export const seedSavedProperties: SavedProperty[] = [
  { tenant_id: "u-tenant-2", property_id: "p-4", created_at: "2026-08-12T00:00:00Z" },
];

export const seedSavedTenants: SavedTenant[] = [
  { landlord_id: "u-landlord-1", tenant_id: "u-tenant-1", created_at: "2026-08-10T00:00:00Z" },
];

export const seedTenantInvitations: TenantInvitation[] = [
  {
    id: "inv-1", landlord_id: "u-landlord-1", tenant_id: "u-tenant-1", property_id: "p-5",
    status: "sent", message: "Your Passport is a great match for our Farnam St studio — would you like to apply?",
    created_at: "2026-08-15T00:00:00Z", responded_at: null,
  },
];

export const seedTenantInterests: TenantInterest[] = [
  { tenant_id: "u-tenant-2", property_id: "p-3", created_at: "2026-08-13T00:00:00Z" },
];

export const seedPassportShares: PassportShare[] = [
  { id: "share-1", tenant_id: "u-tenant-1", landlord_id: "u-landlord-1", share_token: "share-token-1", expires_at: null, revoked_at: null, created_at: "2026-08-10T00:00:00Z" },
];

export const seedPassportViews: PassportView[] = [
  { id: "view-1", tenant_id: "u-tenant-1", viewer_landlord_id: "u-landlord-1", viewed_at: "2026-08-10T08:00:00Z" },
];

export const seedLandlordReviews: LandlordReview[] = [];

// ---------- Perfect Rent™ / Perfect Pay™ / Perfect Rewards™ ----------

export const seedRentIncentives: RentIncentive[] = [
  { id: "ri-1", property_id: "p-1", type: "passport_verified", discount_cents: 2500, enabled: true, requires_lease_months: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
  { id: "ri-2", property_id: "p-1", type: "longer_lease", discount_cents: 2500, enabled: true, requires_lease_months: 18, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
  { id: "ri-3", property_id: "p-1", type: "auto_payment", discount_cents: 2500, enabled: true, requires_lease_months: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
  { id: "ri-4", property_id: "p-3", type: "rental_history", discount_cents: 2500, enabled: true, requires_lease_months: null, created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z" },
  { id: "ri-5", property_id: "p-1", type: "upfront_rent", discount_cents: 5000, enabled: true, requires_lease_months: null, created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" },
];

// Permissive by default — this one row is the only demonstrated restriction,
// so the "unavailable in this location" path has a real example without
// blocking any other incentive in the seed data. Not real legal research.
export const seedJurisdictionRules: JurisdictionRule[] = [
  { id: "jr-1", state: "NE", incentive_type: "upfront_rent", allowed: false, note: "Requires legal review before enabling in Nebraska.", updated_at: "2026-08-01T00:00:00Z" },
];

// Amara: 6 consecutive on-time payments at 412 Dodge St -> Perfect Pay Bronze.
export const seedPaymentVerifications: PaymentVerification[] = [
  { id: "pay-1", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-03-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-03-02T00:00:00Z" },
  { id: "pay-2", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-04-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-04-02T00:00:00Z" },
  { id: "pay-3", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-05-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-05-02T00:00:00Z" },
  { id: "pay-4", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-06-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-06-02T00:00:00Z" },
  { id: "pay-5", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-07-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-07-02T00:00:00Z" },
  { id: "pay-6", tenant_id: "u-tenant-1", property_id: "p-1", landlord_id: "u-landlord-1", period_start: "2026-08-01", status: "on_time", verified_by: "landlord_confirmation", verified_at: "2026-08-02T00:00:00Z" },
];

export const seedPerfectPayMilestones: PerfectPayMilestone[] = [
  { level: "new", consecutive_payments_required: 0, sort_order: 0 },
  { level: "bronze", consecutive_payments_required: 6, sort_order: 1 },
  { level: "silver", consecutive_payments_required: 12, sort_order: 2 },
  { level: "gold", consecutive_payments_required: 24, sort_order: 3 },
  { level: "platinum", consecutive_payments_required: 36, sort_order: 4 },
];

export const seedRewardEvents: RewardEvent[] = [
  { id: "rw-1", tenant_id: "u-tenant-1", type: "perfect_pay_milestone", body: "🏆 Perfect Pay milestone! You've completed 6 verified on-time rent payments — Perfect Pay Bronze achieved.", created_at: "2026-08-02T00:00:00Z" },
];

// ---------- Perfect Partners™ (advertising & monetization) ----------
//
// "Example ___" naming below is deliberate: these are placeholder demo
// entries (same spirit as the rest of this app's seed data — Amara, Priya,
// etc. are fictional too) so the advertising UI has something real to
// render, not a claim that an actual partnership with these businesses
// exists. Replace with real reviewed partnerships before production use.

export const seedAdvertisers: Advertiser[] = [
  // Marcus self-promoting his own property — the only "advertiser" in this
  // pass created through the landlord-facing product, not by an admin.
  { id: "adv-1", name: "Marcus Rentals LLC", category: "real_estate", website: null, contact_email: null, owner_landlord_id: "u-landlord-2", verified_business: false, verified_at: null, created_at: "2026-08-19T00:00:00Z" },
  { id: "adv-2", name: "Example Moving Co.", category: "moving", website: null, contact_email: null, owner_landlord_id: null, verified_business: true, verified_at: "2026-07-01T00:00:00Z", created_at: "2026-07-01T00:00:00Z" },
  { id: "adv-3", name: "Example Renters Insurance Co.", category: "financial_insurance", website: null, contact_email: null, owner_landlord_id: null, verified_business: true, verified_at: "2026-07-01T00:00:00Z", created_at: "2026-07-01T00:00:00Z" },
  { id: "adv-4", name: "Example Internet Co.", category: "utilities", website: null, contact_email: null, owner_landlord_id: null, verified_business: false, verified_at: null, created_at: "2026-07-01T00:00:00Z" },
];

export const seedAdPackages: AdPackage[] = [
  { id: "pkg-1", name: "7-Day Boost", campaign_type: "sponsored_property", duration_days: 7, price_cents: 999, active: true, sort_order: 0 },
  { id: "pkg-2", name: "14-Day Featured", campaign_type: "sponsored_property", duration_days: 14, price_cents: 1999, active: true, sort_order: 1 },
  { id: "pkg-3", name: "30-Day Featured", campaign_type: "sponsored_property", duration_days: 30, price_cents: 2999, active: true, sort_order: 2 },
  { id: "pkg-4", name: "Premium Featured", campaign_type: "sponsored_property", duration_days: 30, price_cents: 4999, active: true, sort_order: 3 },
];

// One demo sponsored-property campaign, already approved, so the search/
// matches "⭐ Sponsored" placement has something real to demonstrate.
// Currently active as of the seeded "today" (2026-08-30): starts 2026-08-20,
// 14-Day Featured package ends 2026-09-03.
export const seedAdCampaigns: AdCampaign[] = [
  {
    id: "camp-1", advertiser_id: "adv-1", campaign_type: "sponsored_property", status: "approved",
    property_id: "p-4", landlord_id: "u-landlord-2", package_id: "pkg-2",
    target_city: "Papillion", target_state: "NE", target_zip: "68046", target_radius_miles: null,
    headline: "Modern townhouse with community pool", description: null, offer_text: null,
    cta_label: "View Listing", destination_url: null, image_url: null,
    starts_at: "2026-08-20T00:00:00Z", ends_at: "2026-09-03T00:00:00Z", rejection_reason: null,
    created_at: "2026-08-19T00:00:00Z", reviewed_at: "2026-08-20T00:00:00Z",
  },
];

export const seedPerfectPartners: PerfectPartner[] = [
  { id: "pp-1", advertiser_id: "adv-2", category: "moving", name: "Example Moving Co.", emoji: "🚚", tagline: "Move into your new home for less.", active: true, sort_order: 0 },
  { id: "pp-2", advertiser_id: "adv-3", category: "financial_insurance", name: "Example Renters Insurance Co.", emoji: "🛡️", tagline: "Protect your new home.", active: true, sort_order: 1 },
  { id: "pp-3", advertiser_id: "adv-4", category: "utilities", name: "Example Internet Co.", emoji: "📡", tagline: "Moving soon? See available offers.", active: true, sort_order: 2 },
];

export const seedPartnerOffers: PartnerOffer[] = [
  { id: "po-1", partner_id: "pp-1", title: "Moving Special", description: "Save on your move with a participating mover.", offer_text: "$50 off a qualifying move", promo_code: "PERFECT50", cta_label: "Get Offer", destination_url: null, expires_at: "2026-12-31T00:00:00Z", active: true },
  { id: "po-2", partner_id: "pp-2", title: "Renters Insurance", description: "Compare coverage from participating providers.", offer_text: "Free quote + special new-renter pricing", promo_code: null, cta_label: "Get a Quote", destination_url: null, expires_at: null, active: true },
  { id: "po-3", partner_id: "pp-3", title: "New-Home Internet Offer", description: "See available internet offers in your area.", offer_text: "Special new-home pricing", promo_code: null, cta_label: "View Offers", destination_url: null, expires_at: null, active: true },
];

// A real event tied to camp-1's real approval and pkg-2's real configured
// price — never an invented number (see getAdvertisingRevenue).
export const seedAdRevenueEvents: AdRevenueEvent[] = [
  { id: "rev-1", campaign_id: "camp-1", amount_cents: 1999, created_at: "2026-08-20T00:00:00Z" },
];

export const seedAdFrequencyRules: AdFrequencyRules = {
  max_sponsored_properties_per_page: 1,
  max_partner_cards_per_page: 2,
  ads_enabled: true,
};

// Dev-mode only: plaintext passwords for the seeded demo accounts.
// Never do this against a real backend — Supabase Auth handles hashing there.
export const seedPasswords: Record<string, string> = {
  "amara.tenant@example.com": "password123",
  "devon.tenant@example.com": "password123",
  "priya.landlord@example.com": "password123",
  "marcus.landlord@example.com": "password123",
};
