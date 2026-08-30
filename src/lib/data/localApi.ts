// Data-access facade used by every page/component. Phase 1 runs entirely
// against the local dev-mode store (localStorage, seeded from src/data/seed)
// so the app is fully clickable with zero backend setup. Every function here
// is shaped 1:1 against the SQL schema in supabase/migrations/ — wiring a
// live Supabase project means using supabaseApi.ts instead (see api.ts),
// with no changes required in pages/components. See docs/ARCHITECTURE.md.

import type {
  Application,
  ApplicationStatus,
  Conversation,
  IncentiveType,
  InvitationStatus,
  JurisdictionRule,
  LandlordReview,
  Message,
  Notification,
  PassportShare,
  PassportView,
  PaymentStatus,
  PaymentVerification,
  PerfectPayLevel,
  PerfectPayMilestone,
  Property,
  PropertyWithPhotos,
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
} from "@/types/domain";
import { computeOnTimeStreak } from "@/types/domain";
import { getDb, mutate, newId } from "./localStore";
import { scoreMatch } from "@/lib/match/score";
import {
  ApiError,
  type AdminMetrics,
  type AuthUser,
  type MarketplaceTenant,
  type NewLandlordReview,
  type NewProperty,
  type PropertyFilter,
  type ScoredProperty,
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
      db.tenants.push({ user_id: id, intro_text: null, photo_url: null, household_size: 1, lease_pref_months: 12, passport_visibility: "marketplace", auto_payment_enrolled: false });
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

export async function createPassportShare(tenantId: string, landlordId: string | null): Promise<PassportShare> {
  return mutate((db) => {
    const share: PassportShare = {
      id: newId("share"), tenant_id: tenantId, landlord_id: landlordId,
      share_token: newId("token"), expires_at: null, revoked_at: null, created_at: new Date().toISOString(),
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
  patch: Partial<Pick<RentIncentive, "discount_cents" | "enabled" | "requires_lease_months">>,
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
  };
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

// ---------- Billing ----------
// Local dev-mode has no Stripe integration — the Pricing page falls back to
// setSubscriptionTier directly when this returns null.
export const startCheckout: import("./types").StartCheckout = async () => null;
