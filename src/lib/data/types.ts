// Shared types between the local dev-mode implementation (localApi.ts) and
// the Supabase-backed implementation (supabaseApi.ts). api.ts picks one of
// the two at module load time based on isSupabaseConfigured and re-exports
// it, so every page/component only ever depends on this file's types plus
// api.ts's function signatures — never on which backend is active.

import type { Property, PropertyType, Role, TenantMatch } from "@/types/domain";

export class ApiError extends Error {}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface PropertyFilter {
  city?: string;
  minRent?: number;
  maxRent?: number;
  beds?: number;
  baths?: number;
  moveInBy?: string;
  types?: PropertyType[];
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
