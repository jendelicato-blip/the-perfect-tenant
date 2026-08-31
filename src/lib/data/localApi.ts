// Data-access facade used by every page/component. Phase 1 runs entirely
// against the local dev-mode store (localStorage, seeded from src/data/seed)
// so the app is fully clickable with zero backend setup. Every function here
// is shaped 1:1 against the SQL schema in supabase/migrations/ — wiring a
// live Supabase project means using supabaseApi.ts instead (see api.ts),
// with no changes required in pages/components. See docs/ARCHITECTURE.md.

import type {
  AdCampaign,
  AdCategory,
  AdFrequencyRules,
  AdPackage,
  Advertiser,
  Application,
  ApplicationStatus,
  CampaignStatus,
  CampaignType,
  Conversation,
  Dispute,
  DisputeCategory,
  IncentiveType,
  InvitationStatus,
  JurisdictionRule,
  LandlordPayoutAccount,
  LandlordReview,
  Message,
  Notification,
  OfferRedemption,
  PartnerOffer,
  PassportShare,
  PassportView,
  PaymentMethodType,
  PaymentRefund,
  PaymentStatus,
  PaymentVerification,
  PayoutSchedule,
  PerfectPartner,
  PerfectPayLevel,
  PerfectPayMilestone,
  PlatformFeeConfig,
  Property,
  PropertyWithPhotos,
  RefundType,
  RentIncentive,
  RewardEvent,
  Role,
  SubscriptionPlan,
  SubscriptionTier,
  Tenant,
  TenantArea,
  TenantInterest,
  TenantInvitation,
  TenantPreferences,
  TenantSummary,
  User,
  VerifiedPurchase,
  VerifiedTierConfig,
  WebhookEvent,
} from "@/types/domain";
import { computeOnTimeStreak } from "@/types/domain";
import { getDb, mutate, newId } from "./localStore";
import { scoreMatch } from "@/lib/match/score";
import {
  ApiError,
  type AdminMetrics,
  type AdvertisingRevenue,
  type AuthUser,
  type CampaignMetrics,
  type CurrentRental,
  type LandlordPublicProfile,
  type MarketplaceTenant,
  type NewLandlordReview,
  type NewProperty,
  type PassportViewWithViewer,
  type PropertyFilter,
  type ScoredProperty,
  type TenantAutopayStatus,
} from "./types";

export { ApiError };

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function notify(db: ReturnType<typeof getDb>, userId: string, type: string, body: string) {
  db.notifications.push({ id: newId("notif"), user_id: userId, type, body, created_at: new Date().toISOString(), read_at: null });
}

// ---------- Auth ----------

export async function signUp(email: string, password: string, role: Role): Promise<AuthUser> {
  return mutate((db) => {
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError("An account with that email already exists.");
    }
    const id = newId("u");
    const user: User = { id, email, role, phone: null, is_admin: false, created_at: new Date().toISOString() };
    db.users.push(user);
    db.passwords[email] = password;

    if (role === "tenant") {
      db.tenants.push({
        user_id: id,
        intro_text: null,
        photo_url: null,
        household_size: 1,
        lease_pref_months: 12,
        passport_visibility: "marketplace",
        auto_payment_enrolled: false,
        payment_method_type: null,
        payment_method_last4: null,
        autopay_day: null,
      });
      db.tenantPreferences.push({
        tenant_id: id, min_rent: 0, max_rent: 3000, beds: 1, baths: 1, property_types: ["apartment"],
        move_in_date: new Date().toISOString().slice(0, 10), pets: false, parking_required: false, desired_amenities: [],
      });
      db.identityVerification.push({ tenant_id: id, status: "not_started", provider: null, verified_at: null, expires_at: null });
      db.incomeVerification.push({ tenant_id: id, monthly_income_range: null, status: "not_started", provider: null, verified_at: null, expires_at: null });
      db.employment.push({ tenant_id: id, employer: null, title: null, status: "not_started", provider: null, verified_at: null, expires_at: null });
      db.creditScreenings.push({ tenant_id: id, status: "not_started", provider: null, report_ref: null, completed_at: null, expires_at: null });
      db.backgroundScreenings.push({ tenant_id: id, status: "not_started", provider: null, report_ref: null, completed_at: null });
      db.evictionScreenings.push({ tenant_id: id, status: "not_started", provider: null, completed_at: null });
    } else {
      db.landlords.push({ user_id: id, company_name: null, subscription_tier: "starter", identity_verified: false, contact_verified: false, business_verified: false, verified_at: null });
      db.subscriptions.push({ landlord_id: id, tier: "starter", stripe_customer_id: null, status: "trialing", renews_at: null });
    }

    db.currentUserId = id;
    return { id, email, role, is_admin: false };
  });
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  return mutate((db) => {
    const user = db.users.find((u) => u.email === email);
    if (!user || db.passwords[email] !== password) {
      throw new ApiError("Invalid email or password.");
    }
    db.currentUserId = user.id;
    return { id: user.id, email: user.email, role: user.role, is_admin: user.is_admin };
  });
}

export async function signOut(): Promise<void> {
  mutate((db) => {
    db.currentUserId = null;
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const db = getDb();
  if (!db.currentUserId) return null;
  const user = db.users.find((u) => u.id === db.currentUserId);
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role, is_admin: user.is_admin };
}

// ---------- Tenant profile ----------

function buildTenantSummary(db: ReturnType<typeof getDb>, tenantId: string): TenantSummary | null {
  const tenant = db.tenants.find((t) => t.user_id === tenantId);
  const user = db.users.find((u) => u.id === tenantId);
  const preferences = db.tenantPreferences.find((p) => p.tenant_id === tenantId);
  if (!tenant || !user || !preferences) return null;
  const areas = db.tenantAreas.filter((a) => a.tenant_id === tenantId);
  const hasVerifiedRentalHistory = db.rentalHistory.some((r) => r.tenant_id === tenantId && r.status === "verified");
  const hasVerifiedReference = db.tenantReferences.some((r) => r.tenant_id === tenantId && r.status === "verified");
  return {
    tenant,
    user: { id: user.id, email: user.email },
    preferences,
    areas,
    verification: {
      identity: db.identityVerification.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      income: db.incomeVerification.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      employment: db.employment.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      rentalHistory: hasVerifiedRentalHistory ? "verified" : "not_started",
      credit: db.creditScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      background: db.backgroundScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      eviction: db.evictionScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      references: hasVerifiedReference ? "verified" : "not_started",
    },
    perfect10antVerified: db.verifiedPurchases.some((p) => p.tenant_id === tenantId),
  };
}

export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  return buildTenantSummary(getDb(), tenantId);
}

export async function getTenantVerificationDetails(tenantId: string): Promise<import("@/types/domain").TenantVerificationDetails | null> {
  const db = getDb();
  if (!db.tenants.some((t) => t.user_id === tenantId)) return null;
  const identity = db.identityVerification.find((v) => v.tenant_id === tenantId);
  const income = db.incomeVerification.find((v) => v.tenant_id === tenantId);
  const employment = db.employment.find((v) => v.tenant_id === tenantId);
  const credit = db.creditScreenings.find((v) => v.tenant_id === tenantId);
  const background = db.backgroundScreenings.find((v) => v.tenant_id === tenantId);
  const eviction = db.evictionScreenings.find((v) => v.tenant_id === tenantId);
  return {
    identity: { status: identity?.status ?? "not_started", provider: identity?.provider ?? null, verified_at: identity?.verified_at ?? null, expires_at: identity?.expires_at ?? null },
    income: { status: income?.status ?? "not_started", provider: income?.provider ?? null, verified_at: income?.verified_at ?? null, expires_at: income?.expires_at ?? null, monthly_income_range: income?.monthly_income_range ?? null },
    employment: { status: employment?.status ?? "not_started", provider: employment?.provider ?? null, verified_at: employment?.verified_at ?? null, expires_at: employment?.expires_at ?? null, employer: employment?.employer ?? null, title: employment?.title ?? null },
    credit: { status: credit?.status ?? "not_started", provider: credit?.provider ?? null, verified_at: credit?.completed_at ?? null, expires_at: credit?.expires_at ?? null },
    background: { status: background?.status ?? "not_started", provider: background?.provider ?? null, verified_at: background?.completed_at ?? null, expires_at: null },
    eviction: { status: eviction?.status ?? "not_started", provider: eviction?.provider ?? null, verified_at: eviction?.completed_at ?? null, expires_at: null },
    rentalHistory: db.rentalHistory.filter((r) => r.tenant_id === tenantId),
    references: db.tenantReferences.filter((r) => r.tenant_id === tenantId),
  };
}

export async function updateTenantProfile(tenantId: string, patch: Partial<Tenant>): Promise<void> {
  mutate((db) => {
    const t = db.tenants.find((x) => x.user_id === tenantId);
    if (t) Object.assign(t, patch);
  });
}

export async function updateTenantPreferences(tenantId: string, patch: Partial<TenantPreferences>): Promise<void> {
  mutate((db) => {
    const p = db.tenantPreferences.find((x) => x.tenant_id === tenantId);
    if (p) Object.assign(p, patch);
  });
}

export async function addTenantArea(area: Omit<TenantArea, "id">): Promise<TenantArea> {
  return mutate((db) => {
    const full = { ...area, id: newId("ta") };
    db.tenantAreas.push(full);
    return full;
  });
}

export async function removeTenantArea(areaId: string): Promise<void> {
  mutate((db) => {
    db.tenantAreas = db.tenantAreas.filter((a) => a.id !== areaId);
  });
}

// ---------- Landlord profile ----------

export async function getLandlordProfile(landlordId: string) {
  const db = getDb();
  return db.landlords.find((l) => l.user_id === landlordId) ?? null;
}

// Tenant-facing lookup — see the LandlordPublicProfile comment in types.ts.
// Local dev-mode has no RLS to route around, but keeping the shape
// consistent with the real (view-backed) supabaseApi.ts implementation.
export async function getLandlordPublicProfile(landlordId: string): Promise<LandlordPublicProfile | null> {
  const db = getDb();
  const landlord = db.landlords.find((l) => l.user_id === landlordId);
  const user = db.users.find((u) => u.id === landlordId);
  if (!landlord || !user) return null;
  return {
    landlord_id: landlord.user_id,
    email: user.email,
    company_name: landlord.company_name,
    identity_verified: landlord.identity_verified,
    contact_verified: landlord.contact_verified,
    business_verified: landlord.business_verified,
    verified_at: landlord.verified_at,
  };
}

export async function updateLandlordCompanyName(landlordId: string, companyName: string): Promise<void> {
  mutate((db) => {
    const l = db.landlords.find((x) => x.user_id === landlordId);
    if (l) l.company_name = companyName;
  });
}

// ---------- Properties ----------

function withPhotos(db: ReturnType<typeof getDb>, property: Property): PropertyWithPhotos {
  return { ...property, photos: db.propertyPhotos.filter((p) => p.property_id === property.id) };
}

export async function listProperties(filter: PropertyFilter = {}): Promise<PropertyWithPhotos[]> {
  const db = getDb();
  const results = db.properties
    .filter((p) => p.status === "active")
    .filter((p) => !filter.city || p.city.toLowerCase().includes(filter.city!.toLowerCase()))
    .filter((p) => filter.minRent === undefined || p.rent >= filter.minRent)
    .filter((p) => filter.maxRent === undefined || p.rent <= filter.maxRent)
    .filter((p) => filter.beds === undefined || p.beds >= filter.beds)
    .filter((p) => filter.baths === undefined || p.baths >= filter.baths)
    .filter((p) => !filter.moveInBy || new Date(p.available_date) <= new Date(filter.moveInBy))
    .filter((p) => !filter.types?.length || filter.types.includes(p.type))
    .filter((p) => !filter.petFriendly || p.pet_policy !== "no_pets")
    .map((p) => withPhotos(db, p));
  return delay(results);
}

export async function listPropertiesForLandlord(landlordId: string): Promise<PropertyWithPhotos[]> {
  const db = getDb();
  return db.properties.filter((p) => p.landlord_id === landlordId).map((p) => withPhotos(db, p));
}

export async function getProperty(id: string): Promise<PropertyWithPhotos | null> {
  const db = getDb();
  const p = db.properties.find((x) => x.id === id);
  return p ? withPhotos(db, p) : null;
}

export async function createProperty(input: NewProperty): Promise<Property> {
  return mutate((db) => {
    const property: Property = {
      ...input,
      id: newId("p"),
      status: input.status ?? "active",
      created_at: new Date().toISOString(),
    };
    db.properties.push(property);
    return property;
  });
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<void> {
  mutate((db) => {
    const p = db.properties.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}

export async function deleteProperty(id: string): Promise<void> {
  mutate((db) => {
    db.properties = db.properties.filter((p) => p.id !== id);
    db.propertyPhotos = db.propertyPhotos.filter((ph) => ph.property_id !== id);
  });
}

export async function addPropertyPhoto(propertyId: string, url: string): Promise<void> {
  mutate((db) => {
    const sortOrder = db.propertyPhotos.filter((p) => p.property_id === propertyId).length;
    db.propertyPhotos.push({ id: newId("ph"), property_id: propertyId, url, sort_order: sortOrder });
  });
}

// ---------- Perfect Match™ ----------

export async function getMatchesForTenant(tenantId: string): Promise<ScoredProperty[]> {
  const db = getDb();
  const tenant = db.tenants.find((t) => t.user_id === tenantId);
  const prefs = db.tenantPreferences.find((p) => p.tenant_id === tenantId);
  const areas = db.tenantAreas.filter((a) => a.tenant_id === tenantId);
  if (!prefs || !tenant) return [];
  const active = db.properties.filter((p) => p.status === "active");
  const scored = active.map((property) => {
    const { score, reasons } = scoreMatch(tenant, prefs, areas, property);
    return { property: withPhotos(db, property), score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  return delay(scored);
}

// ---------- Tenant Marketplace (landlord → tenant discovery) ----------

export async function listMarketplaceTenants(landlordId: string, propertyId?: string): Promise<MarketplaceTenant[]> {
  const db = getDb();
  const property = propertyId ? db.properties.find((p) => p.id === propertyId) : null;

  function visibleToLandlord(tenantId: string): boolean {
    const tenant = db.tenants.find((t) => t.user_id === tenantId);
    if (!tenant) return false;
    if (tenant.passport_visibility === "marketplace") return true;
    if (tenant.passport_visibility === "private") return false;
    const hasApplication = db.applications.some(
      (a) => a.tenant_id === tenantId && db.properties.find((p) => p.id === a.property_id)?.landlord_id === landlordId,
    );
    const isSaved = db.savedTenants.some((s) => s.tenant_id === tenantId && s.landlord_id === landlordId);
    return hasApplication || isSaved;
  }

  const tenants = db.tenants
    .filter((t) => visibleToLandlord(t.user_id))
    .map((t) => buildTenantSummary(db, t.user_id))
    .filter((s): s is TenantSummary => s !== null)
    .filter((s) => {
      const req = ["identity", "income", "employment", "rentalHistory", "credit", "background", "eviction", "references"] as const;
      return req.every((k) => s.verification[k] === "verified");
    });

  const results: MarketplaceTenant[] = tenants.map((summary) => {
    if (!property) return { tenant: summary, score: null, reasons: null };
    const tenant = db.tenants.find((t) => t.user_id === summary.tenant.user_id)!;
    const { score, reasons } = scoreMatch(tenant, summary.preferences, summary.areas, property);
    return { tenant: summary, score, reasons };
  });

  results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return results;
}

// ---------- Applications ----------

export async function listApplicationsForTenant(tenantId: string): Promise<Application[]> {
  const db = getDb();
  return db.applications.filter((a) => a.tenant_id === tenantId);
}

export async function listApplicationsForLandlord(landlordId: string): Promise<Application[]> {
  const db = getDb();
  const propertyIds = new Set(db.properties.filter((p) => p.landlord_id === landlordId).map((p) => p.id));
  return db.applications.filter((a) => propertyIds.has(a.property_id));
}

export async function createApplication(tenantId: string, propertyId: string): Promise<Application> {
  return mutate((db) => {
    const existing = db.applications.find((a) => a.tenant_id === tenantId && a.property_id === propertyId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const application: Application = { id: newId("app"), tenant_id: tenantId, property_id: propertyId, status: "submitted", created_at: now, updated_at: now };
    db.applications.push(application);
    return application;
  });
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  mutate((db) => {
    const a = db.applications.find((x) => x.id === applicationId);
    if (a) {
      a.status = status;
      a.updated_at = new Date().toISOString();
      const property = db.properties.find((p) => p.id === a.property_id);
      notify(db, a.tenant_id, "application_status", `Your application for ${property?.address ?? "a property"} is now "${status}".`);
    }
  });
}

// ---------- Messaging ----------

export async function listConversationsForUser(userId: string, role: Role): Promise<Conversation[]> {
  const db = getDb();
  return role === "tenant"
    ? db.conversations.filter((c) => c.tenant_id === userId)
    : db.conversations.filter((c) => c.landlord_id === userId);
}

export async function getOrCreateConversation(tenantId: string, landlordId: string, propertyId: string | null): Promise<Conversation> {
  return mutate((db) => {
    const existing = db.conversations.find(
      (c) => c.tenant_id === tenantId && c.landlord_id === landlordId && c.property_id === propertyId,
    );
    if (existing) return existing;
    const conversation: Conversation = { id: newId("c"), tenant_id: tenantId, landlord_id: landlordId, property_id: propertyId, created_at: new Date().toISOString() };
    db.conversations.push(conversation);
    return conversation;
  });
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  return db.messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  return mutate((db) => {
    const message: Message = { id: newId("m"), conversation_id: conversationId, sender_id: senderId, body, attachment_url: null, created_at: new Date().toISOString(), read_at: null };
    db.messages.push(message);
    return message;
  });
}

// ---------- Saved items ----------

export async function toggleSavedProperty(tenantId: string, propertyId: string): Promise<boolean> {
  return mutate((db) => {
    const idx = db.savedProperties.findIndex((s) => s.tenant_id === tenantId && s.property_id === propertyId);
    if (idx >= 0) {
      db.savedProperties.splice(idx, 1);
      return false;
    }
    db.savedProperties.push({ tenant_id: tenantId, property_id: propertyId, created_at: new Date().toISOString() });
    return true;
  });
}

export async function listSavedProperties(tenantId: string): Promise<PropertyWithPhotos[]> {
  const db = getDb();
  const ids = new Set(db.savedProperties.filter((s) => s.tenant_id === tenantId).map((s) => s.property_id));
  return db.properties.filter((p) => ids.has(p.id)).map((p) => withPhotos(db, p));
}

export async function toggleSavedTenant(landlordId: string, tenantId: string): Promise<boolean> {
  return mutate((db) => {
    const idx = db.savedTenants.findIndex((s) => s.landlord_id === landlordId && s.tenant_id === tenantId);
    if (idx >= 0) {
      db.savedTenants.splice(idx, 1);
      return false;
    }
    db.savedTenants.push({ landlord_id: landlordId, tenant_id: tenantId, created_at: new Date().toISOString() });
    return true;
  });
}

export async function listSavedTenants(landlordId: string): Promise<TenantSummary[]> {
  const db = getDb();
  const ids = db.savedTenants.filter((s) => s.landlord_id === landlordId).map((s) => s.tenant_id);
  const summaries = await Promise.all(ids.map((id) => getTenantSummary(id)));
  return summaries.filter((s): s is TenantSummary => s !== null);
}

// ---------- Tenant invitations ("Invite to Apply") ----------

export async function createInvitation(landlordId: string, tenantId: string, propertyId: string, message?: string): Promise<TenantInvitation> {
  return mutate((db) => {
    const invitation: TenantInvitation = {
      id: newId("inv"), landlord_id: landlordId, tenant_id: tenantId, property_id: propertyId,
      status: "sent", message: message ?? null, created_at: new Date().toISOString(), responded_at: null,
    };
    db.tenantInvitations.push(invitation);
    const property = db.properties.find((p) => p.id === propertyId);
    notify(db, tenantId, "landlord_interest", `A landlord invited you to apply for ${property?.address ?? "a property"}.`);
    return invitation;
  });
}

export async function listInvitationsForTenant(tenantId: string): Promise<TenantInvitation[]> {
  const db = getDb();
  return db.tenantInvitations.filter((i) => i.tenant_id === tenantId);
}

export async function listInvitationsForLandlord(landlordId: string): Promise<TenantInvitation[]> {
  const db = getDb();
  return db.tenantInvitations.filter((i) => i.landlord_id === landlordId);
}

export async function respondToInvitation(invitationId: string, status: InvitationStatus): Promise<void> {
  mutate((db) => {
    const invitation = db.tenantInvitations.find((i) => i.id === invitationId);
    if (invitation) {
      invitation.status = status;
      invitation.responded_at = new Date().toISOString();
    }
  });
}

// ---------- Tenant-initiated property interest ("I'm Interested") ----------

export async function toggleTenantInterest(tenantId: string, propertyId: string): Promise<boolean> {
  return mutate((db) => {
    const idx = db.tenantInterests.findIndex((i) => i.tenant_id === tenantId && i.property_id === propertyId);
    if (idx >= 0) {
      db.tenantInterests.splice(idx, 1);
      return false;
    }
    db.tenantInterests.push({ tenant_id: tenantId, property_id: propertyId, created_at: new Date().toISOString() });
    const property = db.properties.find((p) => p.id === propertyId);
    const tenant = db.users.find((u) => u.id === tenantId);
    if (property) {
      notify(db, property.landlord_id, "tenant_interest", `${tenant?.email ?? "A verified tenant"} is interested in ${property.address}.`);
    }
    return true;
  });
}

export async function listInterestsForLandlord(landlordId: string): Promise<{ interest: TenantInterest; tenant: TenantSummary }[]> {
  const db = getDb();
  const propertyIds = new Set(db.properties.filter((p) => p.landlord_id === landlordId).map((p) => p.id));
  const interests = db.tenantInterests.filter((i) => propertyIds.has(i.property_id));
  const results = await Promise.all(
    interests.map(async (interest) => {
      const tenant = await getTenantSummary(interest.tenant_id);
      return tenant ? { interest, tenant } : null;
    }),
  );
  return results.filter((r): r is { interest: TenantInterest; tenant: TenantSummary } => r !== null);
}

// ---------- Passport sharing + view history ----------

export async function createPassportShare(
  tenantId: string,
  landlordId: string | null,
  expiresInDays: number | null = null,
): Promise<PassportShare> {
  return mutate((db) => {
    const share: PassportShare = {
      id: newId("share"), tenant_id: tenantId, landlord_id: landlordId,
      share_token: newId("token"),
      expires_at: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null,
      revoked_at: null, created_at: new Date().toISOString(),
    };
    db.passportShares.push(share);
    return share;
  });
}

export async function listPassportShares(tenantId: string): Promise<PassportShare[]> {
  const db = getDb();
  return db.passportShares.filter((s) => s.tenant_id === tenantId);
}

export async function revokePassportShare(shareId: string): Promise<void> {
  mutate((db) => {
    const share = db.passportShares.find((s) => s.id === shareId);
    if (share) share.revoked_at = new Date().toISOString();
  });
}

export async function recordPassportView(tenantId: string, viewerLandlordId: string): Promise<void> {
  mutate((db) => {
    db.passportViews.push({ id: newId("view"), tenant_id: tenantId, viewer_landlord_id: viewerLandlordId, viewed_at: new Date().toISOString() });
  });
}

export async function listPassportViews(tenantId: string): Promise<PassportView[]> {
  const db = getDb();
  return db.passportViews.filter((v) => v.tenant_id === tenantId).sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
}

export async function listPassportViewsWithViewers(tenantId: string): Promise<PassportViewWithViewer[]> {
  const db = getDb();
  const views = db.passportViews.filter((v) => v.tenant_id === tenantId).sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
  return views.map((v) => {
    const landlord = db.landlords.find((l) => l.user_id === v.viewer_landlord_id);
    const user = db.users.find((u) => u.id === v.viewer_landlord_id);
    return {
      id: v.id,
      viewed_at: v.viewed_at,
      viewerLandlordId: v.viewer_landlord_id,
      viewerCompanyName: landlord?.company_name ?? null,
      viewerEmail: user?.email ?? "Unknown landlord",
    };
  });
}

// ---------- Landlord reviews ----------

export async function createLandlordReview(input: NewLandlordReview): Promise<LandlordReview> {
  return mutate((db) => {
    const overall = (input.communication_rating + input.maintenance_rating + input.accuracy_rating + input.professionalism_rating + input.move_in_rating) / 5;
    const review: LandlordReview = { ...input, id: newId("review"), overall_rating: Math.round(overall * 10) / 10, created_at: new Date().toISOString() };
    db.landlordReviews.push(review);
    return review;
  });
}

export async function listLandlordReviews(landlordId: string): Promise<LandlordReview[]> {
  const db = getDb();
  return db.landlordReviews.filter((r) => r.landlord_id === landlordId);
}

// ---------- Subscription plans (admin-configurable pricing) ----------

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const db = getDb();
  return db.subscriptionPlans.filter((p) => p.active);
}

export async function updateSubscriptionPlan(tier: SubscriptionTier, patch: Partial<SubscriptionPlan>): Promise<void> {
  mutate((db) => {
    const plan = db.subscriptionPlans.find((p) => p.tier === tier);
    if (plan) Object.assign(plan, patch, { updated_at: new Date().toISOString() });
  });
}

// ---------- Notifications ----------

export async function listNotifications(userId: string): Promise<Notification[]> {
  const db = getDb();
  return db.notifications.filter((n) => n.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  mutate((db) => {
    const n = db.notifications.find((x) => x.id === notificationId);
    if (n) n.read_at = new Date().toISOString();
  });
}

// Inserts a notification of `type` for `userId` only if one doesn't already
// exist — used for one-time nudges (e.g. "you may now qualify for Perfect
// Rent™") that shouldn't repeat every time the triggering page loads.
export async function notifyOnce(userId: string, type: string, body: string): Promise<void> {
  mutate((db) => {
    if (db.notifications.some((n) => n.user_id === userId && n.type === type)) return;
    notify(db, userId, type, body);
  });
}

// ---------- Subscriptions ----------

export async function getSubscription(landlordId: string) {
  const db = getDb();
  return db.subscriptions.find((s) => s.landlord_id === landlordId) ?? null;
}

export async function setSubscriptionTier(landlordId: string, tier: SubscriptionTier): Promise<void> {
  mutate((db) => {
    const sub = db.subscriptions.find((s) => s.landlord_id === landlordId);
    if (sub) sub.tier = tier;
    const landlord = db.landlords.find((l) => l.user_id === landlordId);
    if (landlord) landlord.subscription_tier = tier;
  });
}

// ---------- Applicant tenant summaries for a landlord's property ----------

export async function listApplicantsForProperty(propertyId: string): Promise<{ application: Application; tenant: TenantSummary }[]> {
  const db = getDb();
  const apps = db.applications.filter((a) => a.property_id === propertyId);
  const results = await Promise.all(
    apps.map(async (application) => {
      const tenant = await getTenantSummary(application.tenant_id);
      return tenant ? { application, tenant } : null;
    }),
  );
  return results.filter((r): r is { application: Application; tenant: TenantSummary } => r !== null);
}

// ---------- Perfect Rent™ ----------

export async function listRentIncentives(propertyId: string): Promise<RentIncentive[]> {
  const db = getDb();
  return db.rentIncentives.filter((i) => i.property_id === propertyId);
}

export async function upsertRentIncentive(
  propertyId: string,
  type: IncentiveType,
  patch: Partial<Pick<RentIncentive, "discount_cents" | "enabled" | "requires_lease_months" | "funded_by">>,
): Promise<RentIncentive> {
  return mutate((db) => {
    const existing = db.rentIncentives.find((i) => i.property_id === propertyId && i.type === type);
    const now = new Date().toISOString();
    if (existing) {
      Object.assign(existing, patch, { updated_at: now });
      return existing;
    }
    const incentive: RentIncentive = {
      id: newId("ri"),
      property_id: propertyId,
      type,
      discount_cents: patch.discount_cents ?? 0,
      enabled: patch.enabled ?? true,
      requires_lease_months: patch.requires_lease_months ?? null,
      funded_by: patch.funded_by ?? "landlord",
      created_at: now,
      updated_at: now,
    };
    db.rentIncentives.push(incentive);
    return incentive;
  });
}

export async function listJurisdictionRules(): Promise<JurisdictionRule[]> {
  const db = getDb();
  return db.jurisdictionRules;
}

export async function updateJurisdictionRule(state: string, incentiveType: IncentiveType, allowed: boolean): Promise<void> {
  mutate((db) => {
    const existing = db.jurisdictionRules.find((r) => r.state === state && r.incentive_type === incentiveType);
    if (existing) {
      existing.allowed = allowed;
      existing.updated_at = new Date().toISOString();
    } else {
      db.jurisdictionRules.push({ id: newId("jr"), state, incentive_type: incentiveType, allowed, note: null, updated_at: new Date().toISOString() });
    }
  });
}

export async function setAutoPaymentEnrollment(tenantId: string, enrolled: boolean): Promise<void> {
  mutate((db) => {
    const t = db.tenants.find((x) => x.user_id === tenantId);
    if (t) t.auto_payment_enrolled = enrolled;
  });
}

// ---------- Perfect Pay™ ----------

export async function recordPayment(
  landlordId: string,
  tenantId: string,
  propertyId: string,
  periodStart: string,
  status: PaymentStatus,
): Promise<PaymentVerification> {
  return mutate((db) => {
    const existing = db.paymentVerifications.find(
      (p) => p.tenant_id === tenantId && p.property_id === propertyId && p.period_start === periodStart,
    );
    if (existing) {
      existing.status = status;
      existing.verified_at = new Date().toISOString();
      return existing;
    }
    const payment: PaymentVerification = {
      id: newId("pay"),
      tenant_id: tenantId,
      property_id: propertyId,
      landlord_id: landlordId,
      period_start: periodStart,
      status,
      verified_by: "landlord_confirmation",
      verified_at: new Date().toISOString(),
    };
    db.paymentVerifications.push(payment);

    if (status === "on_time") {
      const streak = computeOnTimeStreak(db.paymentVerifications.filter((p) => p.tenant_id === tenantId));
      const milestone = db.perfectPayMilestones.find((m) => m.consecutive_payments_required === streak && streak > 0);
      if (milestone) {
        db.rewardEvents.push({
          id: newId("rw"),
          tenant_id: tenantId,
          type: "perfect_pay_milestone",
          body: `🏆 Perfect Pay milestone! You've completed ${streak} verified on-time rent payments — Perfect Pay ${milestone.level[0].toUpperCase()}${milestone.level.slice(1)} achieved.`,
          created_at: new Date().toISOString(),
        });
        notify(db, tenantId, "perfect_pay_milestone", `You've reached Perfect Pay ${milestone.level[0].toUpperCase()}${milestone.level.slice(1)}!`);
      }
    }
    return payment;
  });
}

export async function listPaymentVerificationsForTenant(tenantId: string): Promise<PaymentVerification[]> {
  const db = getDb();
  return db.paymentVerifications.filter((p) => p.tenant_id === tenantId);
}

export async function listPaymentVerificationsForLandlord(landlordId: string): Promise<PaymentVerification[]> {
  const db = getDb();
  return db.paymentVerifications.filter((p) => p.landlord_id === landlordId);
}

export async function listPerfectPayMilestones(): Promise<PerfectPayMilestone[]> {
  const db = getDb();
  return db.perfectPayMilestones;
}

// ---------- Perfect Pay™ disputes & refunds ----------
//
// A dispute is the tenant's own disagreement with a landlord-confirmed
// payment_verifications row — it's layered on top of that row, never
// overwrites its status (on_time/late/disputed there is the landlord's own
// attestation). A refund is the landlord's own record that they owe or
// returned money; like everything else in Perfect Pay, no real money moves.

export async function fileDispute(
  paymentVerificationId: string,
  tenantId: string,
  category: DisputeCategory,
  reason: string,
): Promise<Dispute> {
  return mutate((db) => {
    const payment = db.paymentVerifications.find((p) => p.id === paymentVerificationId);
    if (!payment || payment.tenant_id !== tenantId) throw new ApiError("Payment not found.");
    const dispute: Dispute = {
      id: newId("dsp"),
      reporter_id: tenantId,
      subject_id: payment.landlord_id,
      reason,
      status: "open",
      created_at: new Date().toISOString(),
      payment_verification_id: paymentVerificationId,
      category,
    };
    db.disputes.push(dispute);
    notify(db, payment.landlord_id, "payment_dispute_filed", "A tenant disputed a rent payment record.");
    return dispute;
  });
}

export async function resolveDispute(disputeId: string, landlordId: string, resolution: "resolved" | "dismissed"): Promise<void> {
  mutate((db) => {
    const dispute = db.disputes.find((d) => d.id === disputeId);
    if (!dispute || dispute.subject_id !== landlordId) throw new ApiError("Dispute not found.");
    dispute.status = resolution;
    notify(
      db,
      dispute.reporter_id,
      "payment_dispute_resolved",
      resolution === "resolved" ? "Your payment dispute was resolved." : "Your payment dispute was reviewed and dismissed.",
    );
  });
}

export async function listDisputesForTenant(tenantId: string): Promise<Dispute[]> {
  const db = getDb();
  return db.disputes.filter((d) => d.reporter_id === tenantId);
}

export async function listDisputesForLandlord(landlordId: string): Promise<Dispute[]> {
  const db = getDb();
  return db.disputes.filter((d) => d.subject_id === landlordId);
}

export async function issueRefund(
  paymentVerificationId: string,
  landlordId: string,
  amountCents: number,
  type: RefundType,
  reason: string,
): Promise<PaymentRefund> {
  return mutate((db) => {
    const payment = db.paymentVerifications.find((p) => p.id === paymentVerificationId);
    if (!payment || payment.landlord_id !== landlordId) throw new ApiError("Payment not found.");
    const refund: PaymentRefund = {
      id: newId("rfd"),
      payment_verification_id: paymentVerificationId,
      landlord_id: landlordId,
      tenant_id: payment.tenant_id,
      amount_cents: amountCents,
      type,
      reason,
      created_at: new Date().toISOString(),
    };
    db.paymentRefunds.push(refund);
    notify(
      db,
      payment.tenant_id,
      "payment_refund_issued",
      `You received a ${type === "full" ? "full" : "partial"} refund of $${(amountCents / 100).toLocaleString()}.`,
    );
    return refund;
  });
}

export async function listRefundsForTenant(tenantId: string): Promise<PaymentRefund[]> {
  const db = getDb();
  return db.paymentRefunds.filter((r) => r.tenant_id === tenantId);
}

export async function listRefundsForLandlord(landlordId: string): Promise<PaymentRefund[]> {
  const db = getDb();
  return db.paymentRefunds.filter((r) => r.landlord_id === landlordId);
}

// The property behind a tenant's most recently approved application — see
// CurrentRental in ./types for why this (and not a real lease record) is
// what "my current rental" means in this phase.
export async function getCurrentRentalForTenant(tenantId: string): Promise<CurrentRental | null> {
  const db = getDb();
  const approved = db.applications
    .filter((a) => a.tenant_id === tenantId && a.status === "approved")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (!approved) return null;
  const property = await getProperty(approved.property_id);
  if (!property) return null;
  return { application: approved, property };
}

// ---------- Perfect Pay™ Autopay (simulated payment provider) ----------
//
// setTenantPaymentSetup is the only place a "payment method" gets created in
// this phase — it simulates what a real provider's tokenization would hand
// back (a type + last 4) rather than collecting or storing anything real.
// Turning autopay on/off still goes through setAutoPaymentEnrollment, which
// already existed and already feeds the Perfect Rent™ engine's auto_payment
// qualification — this only adds the method/day fields around it.

export async function setTenantPaymentSetup(
  tenantId: string,
  input: { paymentMethodType: PaymentMethodType; last4: string; autopayDay: number },
): Promise<void> {
  mutate((db) => {
    const t = db.tenants.find((x) => x.user_id === tenantId);
    if (!t) return;
    t.payment_method_type = input.paymentMethodType;
    t.payment_method_last4 = input.last4;
    t.autopay_day = input.autopayDay;
  });
}

export async function getLandlordPayoutAccount(landlordId: string): Promise<LandlordPayoutAccount> {
  const db = getDb();
  return (
    db.landlordPayoutAccounts.find((a) => a.landlord_id === landlordId) ?? {
      landlord_id: landlordId,
      connected: false,
      last4: null,
      payout_schedule: "monthly",
      connected_at: null,
    }
  );
}

// Simulated instant "Connect" — a real integration would redirect to the
// provider's own onboarding flow and only mark `connected` from a webhook
// once that flow actually completes.
export async function connectLandlordPayoutAccount(landlordId: string, last4: string): Promise<void> {
  mutate((db) => {
    const existing = db.landlordPayoutAccounts.find((a) => a.landlord_id === landlordId);
    const now = new Date().toISOString();
    if (existing) {
      existing.connected = true;
      existing.last4 = last4;
      existing.connected_at = now;
    } else {
      db.landlordPayoutAccounts.push({ landlord_id: landlordId, connected: true, last4, payout_schedule: "monthly", connected_at: now });
    }
  });
}

export async function updateLandlordPayoutSchedule(landlordId: string, schedule: PayoutSchedule): Promise<void> {
  mutate((db) => {
    const existing = db.landlordPayoutAccounts.find((a) => a.landlord_id === landlordId);
    if (existing) existing.payout_schedule = schedule;
  });
}

export async function getPlatformFeeConfig(): Promise<PlatformFeeConfig> {
  const db = getDb();
  return db.platformFeeConfig;
}

export async function listLandlordTenantAutopayStatus(landlordId: string): Promise<TenantAutopayStatus[]> {
  const db = getDb();
  const myPropertyIds = new Set(db.properties.filter((p) => p.landlord_id === landlordId).map((p) => p.id));
  const tenantIds = new Set(
    db.applications.filter((a) => a.status === "approved" && myPropertyIds.has(a.property_id)).map((a) => a.tenant_id),
  );
  return [...tenantIds].map((tenantId) => ({
    tenantId,
    autoPaymentEnrolled: db.tenants.find((t) => t.user_id === tenantId)?.auto_payment_enrolled ?? false,
  }));
}

export async function updatePlatformFeeConfig(patch: Partial<Omit<PlatformFeeConfig, "updated_at">>): Promise<void> {
  mutate((db) => {
    Object.assign(db.platformFeeConfig, patch, { updated_at: new Date().toISOString() });
  });
}

export async function getVerifiedTierConfig(): Promise<VerifiedTierConfig> {
  const db = getDb();
  return db.verifiedTierConfig;
}

export async function updateVerifiedTierConfig(patch: Partial<Omit<VerifiedTierConfig, "updated_at">>): Promise<void> {
  mutate((db) => {
    Object.assign(db.verifiedTierConfig, patch, { updated_at: new Date().toISOString() });
  });
}

export async function getOwnVerifiedPurchase(tenantId: string): Promise<VerifiedPurchase | null> {
  const db = getDb();
  const purchases = db.verifiedPurchases.filter((p) => p.tenant_id === tenantId);
  if (purchases.length === 0) return null;
  return [...purchases].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))[0];
}

// No live Stripe project in local dev-mode — same as startCheckout above,
// the UI falls back to purchaseVerifiedDirect when this returns null.
export async function startVerifiedCheckout(): Promise<string | null> {
  return null;
}

// Phase-1 testing fallback (no live Stripe project configured) — records a
// real row in this dev-mode store, but no money moves, exactly like
// setSubscriptionTier's fallback in Pricing.tsx. Never called silently: the
// UI that calls this always discloses it's simulating a purchase.
export async function purchaseVerifiedDirect(tenantId: string, amountPaidCents: number): Promise<void> {
  mutate((db) => {
    db.verifiedPurchases.push({
      id: newId("vp"),
      tenant_id: tenantId,
      amount_paid_cents: amountPaidCents,
      stripe_session_id: null,
      purchased_at: new Date().toISOString(),
    });
  });
}

export async function updatePerfectPayMilestone(level: PerfectPayLevel, consecutivePaymentsRequired: number): Promise<void> {
  mutate((db) => {
    const m = db.perfectPayMilestones.find((x) => x.level === level);
    if (m) m.consecutive_payments_required = consecutivePaymentsRequired;
  });
}

export async function listRewardEvents(tenantId: string): Promise<RewardEvent[]> {
  const db = getDb();
  return db.rewardEvents.filter((r) => r.tenant_id === tenantId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- Perfect Partners™ (advertising & monetization) ----------
// Money changes visibility only — nothing here ever writes to
// tenantMatches or reads scoreMatch's inputs. See src/lib/perfectPartners/engine.ts.

export async function getAdFrequencyRules(): Promise<AdFrequencyRules> {
  const db = getDb();
  return db.adFrequencyRules;
}

export async function updateAdFrequencyRules(patch: Partial<AdFrequencyRules>): Promise<void> {
  mutate((db) => {
    Object.assign(db.adFrequencyRules, patch);
  });
}

function campaignIsActive(c: AdCampaign, now = Date.now()): boolean {
  if (c.status !== "approved") return false;
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return false;
  return true;
}

// Approved + currently date-active sponsored_property campaigns — the set a
// tenant browsing search/matches is allowed to see labeled "Sponsored".
export async function listActiveSponsoredPropertyCampaigns(): Promise<AdCampaign[]> {
  const db = getDb();
  return db.adCampaigns.filter((c) => c.campaign_type === "sponsored_property" && campaignIsActive(c));
}

export async function listPerfectPartners(onlyActive = true): Promise<PerfectPartner[]> {
  const db = getDb();
  const partners = onlyActive ? db.perfectPartners.filter((p) => p.active) : db.perfectPartners;
  return [...partners].sort((a, b) => a.sort_order - b.sort_order);
}

export async function listPartnerOffers(partnerId?: string, onlyActive = true): Promise<PartnerOffer[]> {
  const db = getDb();
  const now = Date.now();
  return db.partnerOffers.filter((o) => {
    if (partnerId && o.partner_id !== partnerId) return false;
    if (onlyActive && !o.active) return false;
    if (onlyActive && o.expires_at && new Date(o.expires_at).getTime() < now) return false;
    return true;
  });
}

export async function recordAdImpression(kind: "campaign" | "offer", id: string, placement: string): Promise<void> {
  mutate((db) => {
    db.adImpressions.push({
      id: newId("imp"),
      campaign_id: kind === "campaign" ? id : null,
      offer_id: kind === "offer" ? id : null,
      placement,
      occurred_at: new Date().toISOString(),
    });
  });
}

export async function recordAdClick(kind: "campaign" | "offer", id: string, placement: string): Promise<void> {
  mutate((db) => {
    db.adClicks.push({
      id: newId("clk"),
      campaign_id: kind === "campaign" ? id : null,
      offer_id: kind === "offer" ? id : null,
      placement,
      occurred_at: new Date().toISOString(),
    });
  });
}

// One row per tenant per offer — a repeat "Get Offer" click doesn't inflate
// the lead count. Also records a click, since redeeming implies a click.
export async function redeemPartnerOffer(tenantId: string, offerId: string): Promise<OfferRedemption> {
  return mutate((db) => {
    const existing = db.offerRedemptions.find((r) => r.offer_id === offerId && r.tenant_id === tenantId);
    if (existing) return existing;
    db.adClicks.push({ id: newId("clk"), campaign_id: null, offer_id: offerId, placement: "partner_offer", occurred_at: new Date().toISOString() });
    const redemption: OfferRedemption = { id: newId("redeem"), offer_id: offerId, tenant_id: tenantId, redeemed_at: new Date().toISOString() };
    db.offerRedemptions.push(redemption);
    return redemption;
  });
}

// ---------- Landlord: promote a property (Sponsored Property) ----------

export async function listAdPackages(campaignType?: CampaignType, onlyActive = true): Promise<AdPackage[]> {
  const db = getDb();
  return db.adPackages
    .filter((p) => (!campaignType || p.campaign_type === campaignType) && (!onlyActive || p.active))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// Lazily creates the one advertiser row a landlord needs to self-promote —
// there's no separate third-party advertiser signup flow in this pass.
export async function getOrCreateAdvertiserForLandlord(landlordId: string): Promise<Advertiser> {
  return mutate((db) => {
    const existing = db.advertisers.find((a) => a.owner_landlord_id === landlordId);
    if (existing) return existing;
    const landlord = db.landlords.find((l) => l.user_id === landlordId);
    const advertiser: Advertiser = {
      id: newId("adv"),
      name: landlord?.company_name ?? "Landlord promotion",
      category: "real_estate" as AdCategory,
      website: null,
      contact_email: null,
      owner_landlord_id: landlordId,
      verified_business: false,
      verified_at: null,
      created_at: new Date().toISOString(),
    };
    db.advertisers.push(advertiser);
    return advertiser;
  });
}

export async function createSponsoredPropertyCampaign(landlordId: string, propertyId: string, packageId: string): Promise<AdCampaign> {
  const advertiser = await getOrCreateAdvertiserForLandlord(landlordId);
  return mutate((db) => {
    const property = db.properties.find((p) => p.id === propertyId);
    const campaign: AdCampaign = {
      id: newId("camp"),
      advertiser_id: advertiser.id,
      campaign_type: "sponsored_property",
      status: "pending_review",
      property_id: propertyId,
      landlord_id: landlordId,
      package_id: packageId,
      target_city: property?.city ?? null,
      target_state: property?.state ?? null,
      target_zip: property?.zip ?? null,
      target_radius_miles: null,
      headline: property?.address ?? "Sponsored listing",
      description: null,
      offer_text: null,
      cta_label: "View Listing",
      destination_url: null,
      image_url: null,
      starts_at: null,
      ends_at: null,
      rejection_reason: null,
      created_at: new Date().toISOString(),
      reviewed_at: null,
    };
    db.adCampaigns.push(campaign);
    return campaign;
  });
}

export async function listCampaignsForLandlord(landlordId: string): Promise<AdCampaign[]> {
  const db = getDb();
  return db.adCampaigns.filter((c) => c.landlord_id === landlordId || db.advertisers.some((a) => a.id === c.advertiser_id && a.owner_landlord_id === landlordId));
}

export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const db = getDb();
  const impressions = db.adImpressions.filter((i) => i.campaign_id === campaignId).length;
  const clicks = db.adClicks.filter((c) => c.campaign_id === campaignId).length;
  const campaign = db.adCampaigns.find((c) => c.id === campaignId);
  const applications = campaign?.property_id ? db.applications.filter((a) => a.property_id === campaign.property_id).length : 0;
  return { impressions, clicks, leads: clicks, applications };
}

// ---------- Admin: Perfect Partners™ management ----------

export async function listCampaignsForReview(status?: CampaignStatus): Promise<AdCampaign[]> {
  const db = getDb();
  return status ? db.adCampaigns.filter((c) => c.status === status) : db.adCampaigns;
}

// Approving a paid (package_id set) campaign records a real
// ad_revenue_events row from the package's real configured price — never a
// fabricated number — and sets a real starts_at/ends_at window from the
// package's duration. No card is ever charged (see README).
export async function reviewCampaign(campaignId: string, decision: "approved" | "rejected", rejectionReason?: string): Promise<void> {
  mutate((db) => {
    const campaign = db.adCampaigns.find((c) => c.id === campaignId);
    if (!campaign) return;
    campaign.status = decision;
    campaign.reviewed_at = new Date().toISOString();
    campaign.rejection_reason = decision === "rejected" ? rejectionReason ?? null : null;
    if (decision === "approved") {
      const pkg = campaign.package_id ? db.adPackages.find((p) => p.id === campaign.package_id) : null;
      const now = new Date();
      campaign.starts_at = now.toISOString();
      if (pkg) {
        campaign.ends_at = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000).toISOString();
        db.adRevenueEvents.push({ id: newId("rev"), campaign_id: campaign.id, amount_cents: pkg.price_cents, created_at: now.toISOString() });
      }
    }
  });
}

export async function setCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
  mutate((db) => {
    const campaign = db.adCampaigns.find((c) => c.id === campaignId);
    if (campaign) campaign.status = status;
  });
}

export async function updateAdPackage(id: string, patch: Partial<Pick<AdPackage, "name" | "duration_days" | "price_cents" | "active">>): Promise<void> {
  mutate((db) => {
    const pkg = db.adPackages.find((p) => p.id === id);
    if (pkg) Object.assign(pkg, patch);
  });
}

export async function createPerfectPartner(input: Omit<PerfectPartner, "id">): Promise<PerfectPartner> {
  return mutate((db) => {
    const partner: PerfectPartner = { ...input, id: newId("pp") };
    db.perfectPartners.push(partner);
    return partner;
  });
}

export async function updatePerfectPartner(id: string, patch: Partial<Omit<PerfectPartner, "id">>): Promise<void> {
  mutate((db) => {
    const partner = db.perfectPartners.find((p) => p.id === id);
    if (partner) Object.assign(partner, patch);
  });
}

export async function createPartnerOffer(input: Omit<PartnerOffer, "id">): Promise<PartnerOffer> {
  return mutate((db) => {
    const offer: PartnerOffer = { ...input, id: newId("po") };
    db.partnerOffers.push(offer);
    return offer;
  });
}

export async function updatePartnerOffer(id: string, patch: Partial<Omit<PartnerOffer, "id">>): Promise<void> {
  mutate((db) => {
    const offer = db.partnerOffers.find((o) => o.id === id);
    if (offer) Object.assign(offer, patch);
  });
}

export async function getAdvertisingRevenue(): Promise<AdvertisingRevenue> {
  const db = getDb();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sumSince = (cutoffMs: number) =>
    db.adRevenueEvents.filter((e) => new Date(e.created_at).getTime() >= cutoffMs).reduce((sum, e) => sum + e.amount_cents, 0);
  return {
    todayCents: sumSince(now - day),
    weekCents: sumSince(now - 7 * day),
    monthCents: sumSince(now - 30 * day),
    yearCents: sumSince(now - 365 * day),
    totalCents: db.adRevenueEvents.reduce((sum, e) => sum + e.amount_cents, 0),
  };
}

// ---------- Admin ----------

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = getDb();
  const tenantSummaries = db.tenants.map((t) => buildTenantSummary(db, t.user_id)).filter((s): s is TenantSummary => s !== null);
  const rentalReadyCount = tenantSummaries.filter((s) => {
    const req = ["identity", "income", "employment", "rentalHistory", "credit", "background", "eviction", "references"] as const;
    return req.every((k) => s.verification[k] === "verified");
  }).length;
  const verifiedLandlords = db.landlords.filter((l) => l.identity_verified && l.contact_verified && l.business_verified).length;
  const planByTier = new Map(db.subscriptionPlans.map((p) => [p.tier, p.price_cents]));
  const mrrCents = db.subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (planByTier.get(s.tier) ?? 0), 0);

  const activeIncentives = db.rentIncentives.filter((i) => i.enabled);
  const propertiesWithIncentives = new Set(activeIncentives.map((i) => i.property_id)).size;
  const avgDiscountCents = activeIncentives.length
    ? Math.round(activeIncentives.reduce((sum, i) => sum + i.discount_cents, 0) / activeIncentives.length)
    : 0;
  const verifiedPaymentTenants = new Set(db.paymentVerifications.map((p) => p.tenant_id)).size;
  const totalOnTimePayments = db.paymentVerifications.filter((p) => p.status === "on_time").length;
  const activeCampaignsCount = db.adCampaigns.filter((c) => campaignIsActive(c)).length;
  const pendingReviewCampaignsCount = db.adCampaigns.filter((c) => c.status === "pending_review").length;
  const autopayEnrolledTenants = db.tenants.filter((t) => t.auto_payment_enrolled).length;
  const autopayRatePercent = db.tenants.length ? Math.round((autopayEnrolledTenants / db.tenants.length) * 100) : 0;
  const connectedPayoutLandlords = db.landlordPayoutAccounts.filter((a) => a.connected).length;
  const perfect10antVerifiedTenants = new Set(db.verifiedPurchases.map((p) => p.tenant_id)).size;
  const verifiedRevenueCents = db.verifiedPurchases.reduce((sum, p) => sum + p.amount_paid_cents, 0);

  return {
    totalTenants: db.tenants.length,
    rentalReadyTenants: rentalReadyCount,
    totalLandlords: db.landlords.length,
    verifiedLandlords,
    totalProperties: db.properties.length,
    totalApplications: db.applications.length,
    passportShares: db.passportShares.length,
    mrrCents,
    activeIncentivesCount: activeIncentives.length,
    propertiesWithIncentives,
    avgDiscountCents,
    verifiedPaymentTenants,
    totalOnTimePayments,
    rewardEventsCount: db.rewardEvents.length,
    activeCampaignsCount,
    pendingReviewCampaignsCount,
    perfectPartnersCount: db.perfectPartners.filter((p) => p.active).length,
    partnerOfferRedemptionsCount: db.offerRedemptions.length,
    autopayEnrolledTenants,
    autopayRatePercent,
    connectedPayoutLandlords,
    perfect10antVerifiedTenants,
    verifiedRevenueCents,
  };
}

// Local dev-mode has no real payment provider calling perfect-pay-webhook —
// there's nothing to seed here that wouldn't be fabricated, so this always
// reports empty. See supabaseApi.ts for the real read.
export async function listRecentWebhookEvents(): Promise<WebhookEvent[]> {
  return [];
}

// ---------- Users ----------

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = getDb();
  return db.users.find((u) => u.id === userId)?.email ?? null;
}

// Own auto-pay enrollment, read directly off `tenants` — unlike
// TenantSummary (sourced from the marketplace-safe view), this is only ever
// called for a tenant looking at their own real Perfect Rent™ calculator.
export async function getOwnAutoPaymentEnrollment(tenantId: string): Promise<boolean> {
  const db = getDb();
  return db.tenants.find((t) => t.user_id === tenantId)?.auto_payment_enrolled ?? false;
}

// Same reasoning as getOwnAutoPaymentEnrollment above — payment method/day
// aren't on the marketplace-safe TenantSummary view, so a tenant's own
// Perfect Pay page reads them straight off `tenants` instead.
export async function getOwnPaymentSetup(
  tenantId: string,
): Promise<Pick<Tenant, "auto_payment_enrolled" | "payment_method_type" | "payment_method_last4" | "autopay_day">> {
  const db = getDb();
  const t = db.tenants.find((x) => x.user_id === tenantId);
  return {
    auto_payment_enrolled: t?.auto_payment_enrolled ?? false,
    payment_method_type: t?.payment_method_type ?? null,
    payment_method_last4: t?.payment_method_last4 ?? null,
    autopay_day: t?.autopay_day ?? null,
  };
}

// ---------- Billing ----------
// Local dev-mode has no Stripe integration — the Pricing page falls back to
// setSubscriptionTier directly when this returns null.
export const startCheckout: import("./types").StartCheckout = async () => null;
