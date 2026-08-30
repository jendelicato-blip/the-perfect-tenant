// Data-access facade used by every page/component. Phase 1 runs entirely
// against the local dev-mode store (localStorage, seeded from src/data/seed)
// so the app is fully clickable with zero backend setup. Every function here
// is shaped 1:1 against supabase/migrations/0001_init.sql — wiring a live
// Supabase project means replacing each function body with the equivalent
// `supabase.from(...)` call, with no changes required in pages/components.
// See docs/ARCHITECTURE.md.

import type {
  Application,
  ApplicationStatus,
  Conversation,
  Message,
  Property,
  PropertyStatus,
  PropertyType,
  PropertyWithPhotos,
  Role,
  SubscriptionTier,
  Tenant,
  TenantArea,
  TenantMatch,
  TenantPreferences,
  TenantSummary,
  User,
} from "@/types/domain";
import { getDb, mutate, newId } from "./localStore";
import { scoreMatch } from "@/lib/match/score";

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {}

// ---------- Auth ----------

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export async function signUp(email: string, password: string, role: Role): Promise<AuthUser> {
  return mutate((db) => {
    if (db.users.some((u) => u.email === email)) {
      throw new ApiError("An account with that email already exists.");
    }
    const id = newId("u");
    const user: User = { id, email, role, phone: null, created_at: new Date().toISOString() };
    db.users.push(user);
    db.passwords[email] = password;

    if (role === "tenant") {
      db.tenants.push({ user_id: id, intro_text: null, photo_url: null, household_size: 1, lease_pref_months: 12 });
      db.tenantPreferences.push({ tenant_id: id, min_rent: 0, max_rent: 3000, beds: 1, baths: 1, property_types: ["apartment"], move_in_date: new Date().toISOString().slice(0, 10), pets: false });
      db.identityVerification.push({ tenant_id: id, status: "not_started", provider: null, verified_at: null, expires_at: null });
      db.incomeVerification.push({ tenant_id: id, monthly_income_range: null, status: "not_started", provider: null, verified_at: null, expires_at: null });
      db.creditScreenings.push({ tenant_id: id, status: "not_started", provider: null, report_ref: null, completed_at: null, expires_at: null });
      db.backgroundScreenings.push({ tenant_id: id, status: "not_started", provider: null, report_ref: null, completed_at: null });
      db.evictionScreenings.push({ tenant_id: id, status: "not_started", provider: null, completed_at: null });
    } else {
      db.landlords.push({ user_id: id, company_name: null, subscription_tier: "starter" });
      db.subscriptions.push({ landlord_id: id, tier: "starter", stripe_customer_id: null, status: "trialing", renews_at: null });
    }

    db.currentUserId = id;
    return { id, email, role };
  });
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  return mutate((db) => {
    const user = db.users.find((u) => u.email === email);
    if (!user || db.passwords[email] !== password) {
      throw new ApiError("Invalid email or password.");
    }
    db.currentUserId = user.id;
    return { id: user.id, email: user.email, role: user.role };
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
  return { id: user.id, email: user.email, role: user.role };
}

// ---------- Tenant profile ----------

export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  const db = getDb();
  const tenant = db.tenants.find((t) => t.user_id === tenantId);
  const user = db.users.find((u) => u.id === tenantId);
  const preferences = db.tenantPreferences.find((p) => p.tenant_id === tenantId);
  if (!tenant || !user || !preferences) return null;
  const areas = db.tenantAreas.filter((a) => a.tenant_id === tenantId);
  return {
    tenant,
    user: { id: user.id, email: user.email },
    preferences,
    areas,
    verification: {
      identity: db.identityVerification.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      income: db.incomeVerification.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      credit: db.creditScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      background: db.backgroundScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
      eviction: db.evictionScreenings.find((v) => v.tenant_id === tenantId)?.status ?? "not_started",
    },
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

export interface PropertyFilter {
  city?: string;
  minRent?: number;
  maxRent?: number;
  beds?: number;
  baths?: number;
  moveInBy?: string;
  types?: PropertyType[];
}

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

export type NewProperty = Omit<Property, "id" | "created_at" | "status"> & { status?: PropertyStatus };

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

// ---------- Matching ----------

export interface ScoredProperty {
  property: PropertyWithPhotos;
  score: number;
  reasons: TenantMatch["reasons"];
}

export async function getMatchesForTenant(tenantId: string): Promise<ScoredProperty[]> {
  const db = getDb();
  const prefs = db.tenantPreferences.find((p) => p.tenant_id === tenantId);
  const areas = db.tenantAreas.filter((a) => a.tenant_id === tenantId);
  if (!prefs) return [];
  const active = db.properties.filter((p) => p.status === "active");
  const scored = active.map((property) => {
    const { score, reasons } = scoreMatch(prefs, areas, property);
    return { property: withPhotos(db, property), score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  return delay(scored);
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
