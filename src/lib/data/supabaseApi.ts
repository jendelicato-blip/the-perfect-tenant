// Supabase-backed implementation of the same facade as localApi.ts. Active
// whenever VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see api.ts).
// Every query here maps directly onto supabase/migrations/0001_init.sql —
// RLS policies on each table (and the tenant_public_profile view's own
// authorization WHERE clause) are what actually enforce access control; this
// file just shapes requests/responses to match the domain types.

import type {
  Application,
  ApplicationStatus,
  Conversation,
  Message,
  Property,
  PropertyWithPhotos,
  Role,
  SubscriptionTier,
  Tenant,
  TenantArea,
  TenantPreferences,
  TenantSummary,
  VerificationStatus,
} from "@/types/domain";
import { scoreMatch } from "@/lib/match/score";
import { supabase } from "./supabaseClient";
import { ApiError, type AuthUser, type NewProperty, type PropertyFilter, type ScoredProperty } from "./types";

export { ApiError };

function client() {
  if (!supabase) throw new ApiError("Supabase is not configured.");
  return supabase;
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new ApiError(result.error.message);
  return result.data;
}

// ---------- Auth ----------

export async function signUp(email: string, password: string, role: Role): Promise<AuthUser> {
  const db = client();
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw new ApiError(error.message);
  const authUser = data.user;
  if (!authUser) {
    throw new ApiError("Check your email to confirm your account, then log in.");
  }

  const { error: userError } = await db.from("users").insert({ id: authUser.id, email, role });
  if (userError) throw new ApiError(userError.message);

  if (role === "tenant") {
    await db.from("tenants").insert({ user_id: authUser.id, household_size: 1 });
    await db.from("tenant_preferences").insert({
      tenant_id: authUser.id,
      min_rent: 0,
      max_rent: 3000,
      beds: 1,
      baths: 1,
      property_types: ["apartment"],
      move_in_date: new Date().toISOString().slice(0, 10),
      pets: false,
    });
    await db.from("identity_verification").insert({ tenant_id: authUser.id });
    await db.from("income_verification").insert({ tenant_id: authUser.id });
    await db.from("credit_screenings").insert({ tenant_id: authUser.id });
    await db.from("background_screenings").insert({ tenant_id: authUser.id });
    await db.from("eviction_screenings").insert({ tenant_id: authUser.id });
  } else {
    await db.from("landlords").insert({ user_id: authUser.id });
    await db.from("subscriptions").insert({ landlord_id: authUser.id, tier: "starter", status: "trialing" });
  }

  return { id: authUser.id, email, role };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(error.message);
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id, email, role")
    .eq("id", data.user.id)
    .single();
  if (profileError) throw new ApiError(profileError.message);
  return profile as AuthUser;
}

export async function signOut(): Promise<void> {
  const db = client();
  await db.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const db = client();
  const { data } = await db.auth.getSession();
  if (!data.session) return null;
  const { data: profile } = await db
    .from("users")
    .select("id, email, role")
    .eq("id", data.session.user.id)
    .single();
  return (profile as AuthUser) ?? null;
}

// ---------- Tenant profile ----------

export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  const db = client();
  const { data: tenant } = await db.from("tenants").select("*").eq("user_id", tenantId).single();
  if (!tenant) return null;
  const { data: user } = await db.from("users").select("id, email").eq("id", tenantId).single();
  const { data: preferences } = await db.from("tenant_preferences").select("*").eq("tenant_id", tenantId).single();
  const { data: areas } = await db.from("tenant_areas").select("*").eq("tenant_id", tenantId);
  const [identity, income, credit, background, eviction] = await Promise.all([
    db.from("identity_verification").select("status").eq("tenant_id", tenantId).single(),
    db.from("income_verification").select("status").eq("tenant_id", tenantId).single(),
    db.from("credit_screenings").select("status").eq("tenant_id", tenantId).single(),
    db.from("background_screenings").select("status").eq("tenant_id", tenantId).single(),
    db.from("eviction_screenings").select("status").eq("tenant_id", tenantId).single(),
  ]);
  if (!user || !preferences) return null;
  return {
    tenant: tenant as Tenant,
    user,
    preferences: preferences as TenantPreferences,
    areas: (areas ?? []) as TenantArea[],
    verification: {
      identity: (identity.data?.status ?? "not_started") as VerificationStatus,
      income: (income.data?.status ?? "not_started") as VerificationStatus,
      credit: (credit.data?.status ?? "not_started") as VerificationStatus,
      background: (background.data?.status ?? "not_started") as VerificationStatus,
      eviction: (eviction.data?.status ?? "not_started") as VerificationStatus,
    },
  };
}

export async function updateTenantProfile(tenantId: string, patch: Partial<Tenant>): Promise<void> {
  const db = client();
  unwrap(await db.from("tenants").update(patch).eq("user_id", tenantId));
}

export async function updateTenantPreferences(tenantId: string, patch: Partial<TenantPreferences>): Promise<void> {
  const db = client();
  unwrap(await db.from("tenant_preferences").update(patch).eq("tenant_id", tenantId));
}

export async function addTenantArea(area: Omit<TenantArea, "id">): Promise<TenantArea> {
  const db = client();
  const { data, error } = await db.from("tenant_areas").insert(area).select().single();
  if (error) throw new ApiError(error.message);
  return data as TenantArea;
}

export async function removeTenantArea(areaId: string): Promise<void> {
  const db = client();
  await db.from("tenant_areas").delete().eq("id", areaId);
}

// ---------- Landlord profile ----------

export async function getLandlordProfile(landlordId: string) {
  const db = client();
  const { data } = await db.from("landlords").select("*").eq("user_id", landlordId).single();
  return data ?? null;
}

export async function updateLandlordCompanyName(landlordId: string, companyName: string): Promise<void> {
  const db = client();
  await db.from("landlords").update({ company_name: companyName }).eq("user_id", landlordId);
}

// ---------- Properties ----------

async function withPhotos(propertyIds: string[]): Promise<Record<string, PropertyWithPhotos["photos"]>> {
  if (propertyIds.length === 0) return {};
  const db = client();
  const { data } = await db.from("property_photos").select("*").in("property_id", propertyIds);
  const grouped: Record<string, PropertyWithPhotos["photos"]> = {};
  for (const photo of data ?? []) {
    (grouped[photo.property_id] ??= []).push(photo);
  }
  return grouped;
}

function attachPhotos(properties: Property[], photosByProperty: Record<string, PropertyWithPhotos["photos"]>): PropertyWithPhotos[] {
  return properties.map((p) => ({ ...p, photos: photosByProperty[p.id] ?? [] }));
}

export async function listProperties(filter: PropertyFilter = {}): Promise<PropertyWithPhotos[]> {
  const db = client();
  let query = db.from("properties").select("*").eq("status", "active");
  if (filter.city) query = query.ilike("city", `%${filter.city}%`);
  if (filter.minRent !== undefined) query = query.gte("rent", filter.minRent);
  if (filter.maxRent !== undefined) query = query.lte("rent", filter.maxRent);
  if (filter.beds !== undefined) query = query.gte("beds", filter.beds);
  if (filter.baths !== undefined) query = query.gte("baths", filter.baths);
  if (filter.moveInBy) query = query.lte("available_date", filter.moveInBy);
  if (filter.types?.length) query = query.in("type", filter.types);

  const { data, error } = await query;
  if (error) throw new ApiError(error.message);
  const properties = (data ?? []) as Property[];
  const photos = await withPhotos(properties.map((p) => p.id));
  return attachPhotos(properties, photos);
}

export async function listPropertiesForLandlord(landlordId: string): Promise<PropertyWithPhotos[]> {
  const db = client();
  const { data, error } = await db.from("properties").select("*").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  const properties = (data ?? []) as Property[];
  const photos = await withPhotos(properties.map((p) => p.id));
  return attachPhotos(properties, photos);
}

export async function getProperty(id: string): Promise<PropertyWithPhotos | null> {
  const db = client();
  const { data } = await db.from("properties").select("*").eq("id", id).single();
  if (!data) return null;
  const photos = await withPhotos([id]);
  return attachPhotos([data as Property], photos)[0];
}

export async function createProperty(input: NewProperty): Promise<Property> {
  const db = client();
  const { data, error } = await db
    .from("properties")
    .insert({ ...input, status: input.status ?? "active" })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as Property;
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<void> {
  const db = client();
  unwrap(await db.from("properties").update(patch).eq("id", id));
}

export async function deleteProperty(id: string): Promise<void> {
  const db = client();
  await db.from("properties").delete().eq("id", id);
}

export async function addPropertyPhoto(propertyId: string, url: string): Promise<void> {
  const db = client();
  const { count } = await db
    .from("property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  await db.from("property_photos").insert({ property_id: propertyId, url, sort_order: count ?? 0 });
}

// ---------- Matching ----------
// Phase 1 computes match scores client-side against whatever active
// properties the tenant's own RLS-scoped read returns, then (best-effort)
// upserts them into tenant_matches for later analytics. If that persistence
// fails for any reason, scores are still returned to the caller — it is
// non-critical cache, not the source of truth.

export async function getMatchesForTenant(tenantId: string): Promise<ScoredProperty[]> {
  const db = client();
  const { data: prefs } = await db.from("tenant_preferences").select("*").eq("tenant_id", tenantId).single();
  if (!prefs) return [];
  const { data: areas } = await db.from("tenant_areas").select("*").eq("tenant_id", tenantId);
  const properties = await listProperties();

  const scored = properties.map((property) => {
    const { score, reasons } = scoreMatch(prefs as TenantPreferences, (areas ?? []) as TenantArea[], property);
    return { property, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score);

  void db
    .from("tenant_matches")
    .upsert(
      scored.map((s) => ({ tenant_id: tenantId, property_id: s.property.id, score: s.score, reasons_json: s.reasons })),
    );

  return scored;
}

// ---------- Applications ----------

export async function listApplicationsForTenant(tenantId: string): Promise<Application[]> {
  const db = client();
  const { data, error } = await db.from("applications").select("*").eq("tenant_id", tenantId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as Application[];
}

export async function listApplicationsForLandlord(landlordId: string): Promise<Application[]> {
  const db = client();
  const { data: properties } = await db.from("properties").select("id").eq("landlord_id", landlordId);
  const propertyIds = (properties ?? []).map((p) => p.id);
  if (propertyIds.length === 0) return [];
  const { data, error } = await db.from("applications").select("*").in("property_id", propertyIds);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as Application[];
}

export async function createApplication(tenantId: string, propertyId: string): Promise<Application> {
  const db = client();
  const { data, error } = await db
    .from("applications")
    .upsert({ tenant_id: tenantId, property_id: propertyId }, { onConflict: "tenant_id,property_id", ignoreDuplicates: true })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as Application;
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  const db = client();
  unwrap(await db.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", applicationId));
}

// ---------- Messaging ----------

export async function listConversationsForUser(userId: string, role: Role): Promise<Conversation[]> {
  const db = client();
  const column = role === "tenant" ? "tenant_id" : "landlord_id";
  const { data, error } = await db.from("conversations").select("*").eq(column, userId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as Conversation[];
}

export async function getOrCreateConversation(
  tenantId: string,
  landlordId: string,
  propertyId: string | null,
): Promise<Conversation> {
  const db = client();
  let query = db.from("conversations").select("*").eq("tenant_id", tenantId).eq("landlord_id", landlordId);
  query = propertyId ? query.eq("property_id", propertyId) : query.is("property_id", null);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing as Conversation;

  const { data, error } = await db
    .from("conversations")
    .insert({ tenant_id: tenantId, landlord_id: landlordId, property_id: propertyId })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as Conversation;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const db = client();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const db = client();
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as Message;
}

// ---------- Saved items ----------

export async function toggleSavedProperty(tenantId: string, propertyId: string): Promise<boolean> {
  const db = client();
  const { data: existing } = await db
    .from("saved_properties")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existing) {
    await db.from("saved_properties").delete().eq("tenant_id", tenantId).eq("property_id", propertyId);
    return false;
  }
  await db.from("saved_properties").insert({ tenant_id: tenantId, property_id: propertyId });
  return true;
}

export async function listSavedProperties(tenantId: string): Promise<PropertyWithPhotos[]> {
  const db = client();
  const { data: saved } = await db.from("saved_properties").select("property_id").eq("tenant_id", tenantId);
  const ids = (saved ?? []).map((s) => s.property_id);
  if (ids.length === 0) return [];
  const { data, error } = await db.from("properties").select("*").in("id", ids);
  if (error) throw new ApiError(error.message);
  const properties = (data ?? []) as Property[];
  const photos = await withPhotos(properties.map((p) => p.id));
  return attachPhotos(properties, photos);
}

export async function toggleSavedTenant(landlordId: string, tenantId: string): Promise<boolean> {
  const db = client();
  const { data: existing } = await db
    .from("saved_tenants")
    .select("*")
    .eq("landlord_id", landlordId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (existing) {
    await db.from("saved_tenants").delete().eq("landlord_id", landlordId).eq("tenant_id", tenantId);
    return false;
  }
  await db.from("saved_tenants").insert({ landlord_id: landlordId, tenant_id: tenantId });
  return true;
}

export async function listSavedTenants(landlordId: string): Promise<TenantSummary[]> {
  const db = client();
  const { data: saved } = await db.from("saved_tenants").select("tenant_id").eq("landlord_id", landlordId);
  const ids = (saved ?? []).map((s) => s.tenant_id);
  const summaries = await Promise.all(ids.map((id) => getTenantSummary(id)));
  return summaries.filter((s): s is TenantSummary => s !== null);
}

// ---------- Subscriptions ----------

export async function getSubscription(landlordId: string) {
  const db = client();
  const { data } = await db.from("subscriptions").select("*").eq("landlord_id", landlordId).single();
  return data ?? null;
}

export async function setSubscriptionTier(landlordId: string, tier: SubscriptionTier): Promise<void> {
  const db = client();
  await db.from("subscriptions").update({ tier }).eq("landlord_id", landlordId);
  await db.from("landlords").update({ subscription_tier: tier }).eq("user_id", landlordId);
}

// ---------- Applicants for a landlord's property ----------

export async function listApplicantsForProperty(
  propertyId: string,
): Promise<{ application: Application; tenant: TenantSummary }[]> {
  const db = client();
  const { data: apps, error } = await db.from("applications").select("*").eq("property_id", propertyId);
  if (error) throw new ApiError(error.message);
  const results = await Promise.all(
    (apps ?? []).map(async (application) => {
      const tenant = await getTenantSummary(application.tenant_id);
      return tenant ? { application: application as Application, tenant } : null;
    }),
  );
  return results.filter((r): r is { application: Application; tenant: TenantSummary } => r !== null);
}

// ---------- Users ----------

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = client();
  const { data } = await db.from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

// ---------- Billing ----------
// Invokes the stripe-checkout Edge Function (supabase/functions/stripe-checkout).
// Returns null (rather than throwing) when checkout isn't configured yet
// (e.g. Stripe secrets not set), so the Pricing page can fall back to the
// Phase 1 stub instead of surfacing a hard error to a landlord just testing tiers.
export const startCheckout: import("./types").StartCheckout = async (_landlordId, tier) => {
  const db = client();
  const { data, error } = await db.functions.invoke<{ url?: string; error?: string }>("stripe-checkout", {
    body: { tier },
  });
  if (error || !data?.url) return null;
  return data.url;
};
