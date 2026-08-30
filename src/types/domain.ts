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
  created_at: string;
}

export interface Tenant {
  user_id: string;
  intro_text: string | null;
  photo_url: string | null;
  household_size: number;
  lease_pref_months: number | null;
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
}

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
  pet_policy: "no_pets" | "cats_only" | "dogs_only" | "cats_and_dogs" | "case_by_case";
  amenities: string[];
  description: string;
  status: PropertyStatus;
  created_at: string;
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

// Composite view types used by the UI (never expose verification base tables
// directly to a landlord-facing client — this is the shape the "safe view"
// RLS policies in the migration are designed to produce).
export interface TenantSummary {
  tenant: Tenant;
  user: Pick<User, "id" | "email">;
  preferences: TenantPreferences;
  areas: TenantArea[];
  verification: {
    identity: VerificationStatus;
    income: VerificationStatus;
    credit: VerificationStatus;
    background: VerificationStatus;
    eviction: VerificationStatus;
  };
}

export interface PropertyWithPhotos extends Property {
  photos: PropertyPhoto[];
}
