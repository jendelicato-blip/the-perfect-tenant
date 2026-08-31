// Shared types between the local dev-mode implementation (localApi.ts) and
// the Supabase-backed implementation (supabaseApi.ts). api.ts picks one of
// the two at module load time based on isSupabaseConfigured and re-exports
// it, so every page/component only ever depends on this file's types plus
// api.ts's function signatures — never on which backend is active.

import type { LandlordReview, MatchReason, Property, PropertyType, Role, TenantMatch, TenantSummary } from "@/types/domain";

export class ApiError extends Error {}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  is_admin: boolean;
}

export interface PropertyFilter {
  city?: string;
  minRent?: number;
  maxRent?: number;
  beds?: number;
  baths?: number;
  moveInBy?: string;
  types?: PropertyType[];
  petFriendly?: boolean;
}

export type NewProperty = Omit<Property, "id" | "created_at" | "status"> & {
  status?: Property["status"];
};

export interface ScoredProperty {
  property: import("@/types/domain").PropertyWithPhotos;
  score: number;
  reasons: TenantMatch["reasons"];
}

// Returns a Stripe Checkout URL to redirect to, or null when real checkout
// isn't wired up (local dev-mode, or Stripe secrets not yet configured) — the
// caller falls back to updating the tier directly for Phase 1 testing.
export type StartCheckout = (landlordId: string, tier: import("@/types/domain").SubscriptionTier) => Promise<string | null>;

// A Rental Ready tenant surfaced in the landlord-facing Tenant Marketplace.
// score/reasons are present only when scored against a specific property.
export interface MarketplaceTenant {
  tenant: TenantSummary;
  score: number | null;
  reasons: MatchReason[] | null;
}

export type NewLandlordReview = Omit<LandlordReview, "id" | "created_at" | "overall_rating"> & {
  overall_rating?: number;
};

export interface AdminMetrics {
  totalTenants: number;
  rentalReadyTenants: number;
  totalLandlords: number;
  verifiedLandlords: number;
  totalProperties: number;
  totalApplications: number;
  passportShares: number;
  mrrCents: number;
  activeIncentivesCount: number;
  propertiesWithIncentives: number;
  avgDiscountCents: number;
  verifiedPaymentTenants: number;
  totalOnTimePayments: number;
  rewardEventsCount: number;
  activeCampaignsCount: number;
  pendingReviewCampaignsCount: number;
  perfectPartnersCount: number;
  partnerOfferRedemptionsCount: number;
  autopayEnrolledTenants: number;
  autopayRatePercent: number;
  connectedPayoutLandlords: number;
  perfect10antVerifiedTenants: number;
  verifiedRevenueCents: number;
}

// Tenant-facing view of a landlord — deliberately narrower than the
// `Landlord` domain type (no subscription_tier, nothing internal). Backed by
// the landlord_public_profile view (0012) on Supabase; getLandlordProfile
// (a landlord reading their OWN dashboard) is untouched and keeps returning
// the full Landlord row.
export interface LandlordPublicProfile {
  landlord_id: string;
  email: string;
  company_name: string | null;
  identity_verified: boolean;
  contact_verified: boolean;
  business_verified: boolean;
  verified_at: string | null;
}

// A PassportView (domain.ts) enriched with who actually viewed it, for the
// tenant's own "Recent Passport Activity" log — never shown to anyone but
// the tenant themselves (same passport_views_tenant_read RLS as the base
// PassportView read already goes through).
export interface PassportViewWithViewer {
  id: string;
  viewed_at: string;
  viewerLandlordId: string;
  viewerCompanyName: string | null;
  viewerEmail: string;
}

// A tenant's current rental for Perfect Pay purposes — the property behind
// their most recently approved application. There's no separate "lease"
// object yet (see the domain.ts note on that), so this is the same
// approved-application lookup Rewards.tsx already does, centralized so
// every Perfect Pay screen agrees on what "my current rental" means.
export interface CurrentRental {
  application: import("@/types/domain").Application;
  property: import("@/types/domain").PropertyWithPhotos;
}

// Only ever the tenants with an approved application on one of this
// landlord's own properties — see landlord_visible_autopay in
// 0008_landlord_autopay_visibility.sql for why this is safe to expose
// (unlike TenantSummary, which always reports false here for any other
// viewer).
export interface TenantAutopayStatus {
  tenantId: string;
  autoPaymentEnrolled: boolean;
}

// Impressions/clicks are anonymous counters (see 0006_perfect_partners.sql)
// — this is what a landlord's "Your Property Promotion" tile and the admin
// campaign review queue both read, computed from real rows, never invented.
export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  leads: number;
  applications: number;
}

export interface AdvertisingRevenue {
  todayCents: number;
  weekCents: number;
  monthCents: number;
  yearCents: number;
  totalCents: number;
}
