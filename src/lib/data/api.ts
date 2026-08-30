// Data-access facade used by every page/component. Picks the Supabase-backed
// implementation (supabaseApi.ts) when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// are configured, otherwise the local dev-mode implementation (localApi.ts,
// localStorage-backed, seeded from src/data/seed) so the app is fully
// clickable with zero backend setup. Both implementations share the same
// function signatures and types (see types.ts) — pages only ever import from
// this file and never need to know which backend is active.
// See docs/ARCHITECTURE.md.

import { isSupabaseConfigured } from "./supabaseClient";
import * as local from "./localApi";
import * as remote from "./supabaseApi";

const impl = isSupabaseConfigured ? remote : local;

export const {
  ApiError,
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getTenantSummary,
  updateTenantProfile,
  updateTenantPreferences,
  addTenantArea,
  removeTenantArea,
  getLandlordProfile,
  updateLandlordCompanyName,
  listProperties,
  listPropertiesForLandlord,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  addPropertyPhoto,
  getMatchesForTenant,
  listApplicationsForTenant,
  listApplicationsForLandlord,
  createApplication,
  updateApplicationStatus,
  listConversationsForUser,
  getOrCreateConversation,
  listMessages,
  sendMessage,
  toggleSavedProperty,
  listSavedProperties,
  toggleSavedTenant,
  listSavedTenants,
  getSubscription,
  setSubscriptionTier,
  listApplicantsForProperty,
  getUserEmail,
  startCheckout,
} = impl;

export type { AuthUser, NewProperty, PropertyFilter, ScoredProperty } from "./types";
