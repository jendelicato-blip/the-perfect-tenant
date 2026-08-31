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
