// Supabase-backed implementation of the same facade as localApi.ts. Active
// whenever VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see api.ts).
// Every query here maps directly onto supabase/migrations/*.sql — RLS
// policies on each table (and the tenant_public_profile view's own
// authorization WHERE clause) are what actually enforce access control; this
// file just shapes requests/responses to match the domain types.

import type {
  AdCampaign,
  AdFrequencyRules,
  AdPackage,
  Advertiser,
  Application,
  ApplicationStatus,
  CampaignStatus,
  CampaignType,
  Conversation,
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
  PaymentStatus,
  PaymentVerification,
  PayoutSchedule,
  PerfectPartner,
  PerfectPayLevel,
  PerfectPayMilestone,
  PlatformFeeConfig,
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
  TenantVerificationDetails,
  VerificationStatus,
} from "@/types/domain";
import { computeOnTimeStreak } from "@/types/domain";
import { scoreMatch } from "@/lib/match/score";
import { supabase } from "./supabaseClient";
import {
  ApiError,
  type AdminMetrics,
  type AdvertisingRevenue,
  type AuthUser,
  type CampaignMetrics,
  type CurrentRental,
  type MarketplaceTenant,
  type NewLandlordReview,
  type NewProperty,
  type PropertyFilter,
  type ScoredProperty,
  type TenantAutopayStatus,
} from "./types";

export { ApiError };

function client() {
  if (!supabase) throw new ApiError("Supabase is not configured.");
  return supabase;
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new ApiError(result.error.message);
  return result.data;
}

async function notify(userId: string, type: string, body: string): Promise<void> {
  const db = client();
  await db.from("notifications").insert({ user_id: userId, type, body });
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
    await db.from("employment").insert({ tenant_id: authUser.id });
    await db.from("credit_screenings").insert({ tenant_id: authUser.id });
    await db.from("background_screenings").insert({ tenant_id: authUser.id });
    await db.from("eviction_screenings").insert({ tenant_id: authUser.id });
  } else {
    await db.from("landlords").insert({ user_id: authUser.id });
    await db.from("subscriptions").insert({ landlord_id: authUser.id, tier: "starter", status: "trialing" });
  }

  return { id: authUser.id, email, role, is_admin: false };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(error.message);
  const { data: profile, error: profileError } = await db
    .from("users")
    .select("id, email, role, is_admin")
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
    .select("id, email, role, is_admin")
    .eq("id", data.session.user.id)
    .single();
  return (profile as AuthUser) ?? null;
}

// ---------- Tenant profile ----------
// getTenantSummary reads the tenant_public_profile view (status-only,
// visibility-gated — see 0004_tenant_marketplace_visibility.sql) plus
// tenant_areas. This is what both a tenant's own pages AND a landlord's
// (Applicants, Saved Tenants, Marketplace) can safely call — the view's own
// WHERE clause decides what's visible to the caller, not this function.

function summaryFromProfileRow(row: Record<string, unknown>, areas: TenantArea[]): TenantSummary {
  return {
    tenant: {
      user_id: row.tenant_id as string,
      intro_text: (row.intro_text as string) ?? null,
      photo_url: (row.photo_url as string) ?? null,
      household_size: (row.household_size as number) ?? 1,
      lease_pref_months: (row.lease_pref_months as number) ?? null,
      passport_visibility: (row.passport_visibility as Tenant["passport_visibility"]) ?? "marketplace",
      // Not exposed by tenant_public_profile (Perfect Rent's per-tenant
      // marketplace estimate is Phase 1-deferred — see docs/ARCHITECTURE.md);
      // a tenant's own pages read this straight off `tenants` instead. Same
      // reasoning for the payment method/autopay-day fields below — a
      // landlord viewing this tenant's Passport never sees them.
      auto_payment_enrolled: false,
      payment_method_type: null,
      payment_method_last4: null,
      autopay_day: null,
    },
    user: { id: row.tenant_id as string, email: row.email as string },
    preferences: {
      tenant_id: row.tenant_id as string,
      min_rent: (row.min_rent as number) ?? 0,
      max_rent: (row.max_rent as number) ?? 0,
      beds: (row.beds as number) ?? 0,
      baths: (row.baths as number) ?? 0,
      property_types: (row.property_types as TenantPreferences["property_types"]) ?? [],
      move_in_date: (row.move_in_date as string) ?? new Date().toISOString().slice(0, 10),
      pets: Boolean(row.pets),
      parking_required: Boolean(row.parking_required),
      desired_amenities: (row.desired_amenities as string[]) ?? [],
    },
    areas,
    verification: {
      identity: row.identity_status as VerificationStatus,
      income: row.income_status as VerificationStatus,
      employment: row.employment_status as VerificationStatus,
      rentalHistory: row.rental_history_verified ? "verified" : "not_started",
      credit: row.credit_status as VerificationStatus,
      background: row.background_status as VerificationStatus,
      eviction: row.eviction_status as VerificationStatus,
      references: row.references_verified ? "verified" : "not_started",
    },
  };
}

export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  const db = client();
  const { data: row } = await db.from("tenant_public_profile").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!row) return null;
  const { data: areas } = await db.from("tenant_areas").select("*").eq("tenant_id", tenantId);
  return summaryFromProfileRow(row, (areas ?? []) as TenantArea[]);
}

export async function getTenantVerificationDetails(tenantId: string): Promise<TenantVerificationDetails | null> {
  const db = client();
  const [identity, income, employment, credit, background, eviction, rentalHistory, references] = await Promise.all([
    db.from("identity_verification").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("income_verification").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("employment").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("credit_screenings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("background_screenings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("eviction_screenings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("rental_history").select("*").eq("tenant_id", tenantId),
    db.from("tenant_references").select("*").eq("tenant_id", tenantId),
  ]);
  // RLS makes every one of these come back empty for anyone but the tenant
  // themselves — if identity has no row and no error, there's nothing to show.
  if (!identity.data && !income.data && !employment.data) return null;

  return {
    identity: { status: identity.data?.status ?? "not_started", provider: identity.data?.provider ?? null, verified_at: identity.data?.verified_at ?? null, expires_at: identity.data?.expires_at ?? null },
    income: { status: income.data?.status ?? "not_started", provider: income.data?.provider ?? null, verified_at: income.data?.verified_at ?? null, expires_at: income.data?.expires_at ?? null, monthly_income_range: income.data?.monthly_income_range ?? null },
    employment: { status: employment.data?.status ?? "not_started", provider: employment.data?.provider ?? null, verified_at: employment.data?.verified_at ?? null, expires_at: employment.data?.expires_at ?? null, employer: employment.data?.employer ?? null, title: employment.data?.title ?? null },
    credit: { status: credit.data?.status ?? "not_started", provider: credit.data?.provider ?? null, verified_at: credit.data?.completed_at ?? null, expires_at: credit.data?.expires_at ?? null },
    background: { status: background.data?.status ?? "not_started", provider: background.data?.provider ?? null, verified_at: background.data?.completed_at ?? null, expires_at: null },
    eviction: { status: eviction.data?.status ?? "not_started", provider: eviction.data?.provider ?? null, verified_at: eviction.data?.completed_at ?? null, expires_at: null },
    rentalHistory: rentalHistory.data ?? [],
    references: references.data ?? [],
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
  if (filter.petFriendly) query = query.neq("pet_policy", "no_pets");

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

// ---------- Perfect Match™ ----------
// Phase 1 computes match scores client-side against whatever active
// properties the tenant's own RLS-scoped read returns, then (best-effort)
// upserts them into tenant_matches for later analytics. If that persistence
// fails for any reason, scores are still returned to the caller — it is
// non-critical cache, not the source of truth.

export async function getMatchesForTenant(tenantId: string): Promise<ScoredProperty[]> {
  const db = client();
  const { data: tenant } = await db.from("tenants").select("*").eq("user_id", tenantId).single();
  const { data: prefs } = await db.from("tenant_preferences").select("*").eq("tenant_id", tenantId).single();
  if (!prefs || !tenant) return [];
  const { data: areas } = await db.from("tenant_areas").select("*").eq("tenant_id", tenantId);
  const properties = await listProperties();

  const scored = properties.map((property) => {
    const { score, reasons } = scoreMatch(tenant as Tenant, prefs as TenantPreferences, (areas ?? []) as TenantArea[], property);
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

// ---------- Tenant Marketplace (landlord → tenant discovery) ----------

export async function listMarketplaceTenants(_landlordId: string, propertyId?: string): Promise<MarketplaceTenant[]> {
  const db = client();
  // tenant_public_profile's own WHERE clause already scopes rows to those
  // visible to the calling landlord (marketplace opt-in, or an existing
  // application/saved relationship) — no extra filtering needed here.
  const { data: rows, error } = await db.from("tenant_public_profile").select("*");
  if (error) throw new ApiError(error.message);

  const rentalReady = (rows ?? []).filter(
    (r) =>
      r.identity_status === "verified" &&
      r.income_status === "verified" &&
      r.employment_status === "verified" &&
      r.rental_history_verified &&
      r.credit_status === "verified" &&
      r.background_status === "verified" &&
      r.eviction_status === "verified" &&
      r.references_verified,
  );

  const tenantIds = rentalReady.map((r) => r.tenant_id as string);
  const { data: allAreas } = tenantIds.length
    ? await db.from("tenant_areas").select("*").in("tenant_id", tenantIds)
    : { data: [] as TenantArea[] };
  const areasByTenant = new Map<string, TenantArea[]>();
  for (const area of allAreas ?? []) {
    const list = areasByTenant.get(area.tenant_id) ?? [];
    list.push(area as TenantArea);
    areasByTenant.set(area.tenant_id, list);
  }

  const property = propertyId ? await getProperty(propertyId) : null;
  // lease_pref_months lives on `tenants`, not the profile view.
  const { data: tenantRows } = tenantIds.length ? await db.from("tenants").select("user_id, lease_pref_months").in("user_id", tenantIds) : { data: [] };
  const leaseByTenant = new Map((tenantRows ?? []).map((t) => [t.user_id as string, t.lease_pref_months as number | null]));

  const results: MarketplaceTenant[] = rentalReady.map((row) => {
    const summary = summaryFromProfileRow(row, areasByTenant.get(row.tenant_id as string) ?? []);
    if (!property) return { tenant: summary, score: null, reasons: null };
    const { score, reasons } = scoreMatch(
      { lease_pref_months: leaseByTenant.get(row.tenant_id as string) ?? null },
      summary.preferences,
      summary.areas,
      property,
    );
    return { tenant: summary, score, reasons };
  });

  results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return results;
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
  const { data: application } = await db.from("applications").select("*").eq("id", applicationId).single();
  unwrap(await db.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", applicationId));
  if (application) {
    const { data: property } = await db.from("properties").select("address").eq("id", application.property_id).single();
    await notify(application.tenant_id, "application_status", `Your application for ${property?.address ?? "a property"} is now "${status}".`);
  }
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

// ---------- Tenant invitations ("Invite to Apply") ----------

export async function createInvitation(landlordId: string, tenantId: string, propertyId: string, message?: string): Promise<TenantInvitation> {
  const db = client();
  const { data, error } = await db
    .from("tenant_invitations")
    .insert({ landlord_id: landlordId, tenant_id: tenantId, property_id: propertyId, message: message ?? null })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  const { data: property } = await db.from("properties").select("address").eq("id", propertyId).single();
  await notify(tenantId, "landlord_interest", `A landlord invited you to apply for ${property?.address ?? "a property"}.`);
  return data as TenantInvitation;
}

export async function listInvitationsForTenant(tenantId: string): Promise<TenantInvitation[]> {
  const db = client();
  const { data, error } = await db.from("tenant_invitations").select("*").eq("tenant_id", tenantId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as TenantInvitation[];
}

export async function listInvitationsForLandlord(landlordId: string): Promise<TenantInvitation[]> {
  const db = client();
  const { data, error } = await db.from("tenant_invitations").select("*").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as TenantInvitation[];
}

export async function respondToInvitation(invitationId: string, status: InvitationStatus): Promise<void> {
  const db = client();
  await db.from("tenant_invitations").update({ status, responded_at: new Date().toISOString() }).eq("id", invitationId);
}

// ---------- Tenant-initiated property interest ("I'm Interested") ----------

export async function toggleTenantInterest(tenantId: string, propertyId: string): Promise<boolean> {
  const db = client();
  const { data: existing } = await db
    .from("tenant_interests")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (existing) {
    await db.from("tenant_interests").delete().eq("tenant_id", tenantId).eq("property_id", propertyId);
    return false;
  }
  await db.from("tenant_interests").insert({ tenant_id: tenantId, property_id: propertyId });
  const { data: property } = await db.from("properties").select("address, landlord_id").eq("id", propertyId).single();
  if (property) {
    await notify(property.landlord_id, "tenant_interest", `A verified tenant is interested in ${property.address}.`);
  }
  return true;
}

export async function listInterestsForLandlord(landlordId: string): Promise<{ interest: TenantInterest; tenant: TenantSummary }[]> {
  const db = client();
  const { data: properties } = await db.from("properties").select("id").eq("landlord_id", landlordId);
  const propertyIds = (properties ?? []).map((p) => p.id);
  if (propertyIds.length === 0) return [];
  const { data: interests, error } = await db.from("tenant_interests").select("*").in("property_id", propertyIds);
  if (error) throw new ApiError(error.message);
  const results = await Promise.all(
    (interests ?? []).map(async (interest) => {
      const tenant = await getTenantSummary(interest.tenant_id);
      return tenant ? { interest: interest as TenantInterest, tenant } : null;
    }),
  );
  return results.filter((r): r is { interest: TenantInterest; tenant: TenantSummary } => r !== null);
}

// ---------- Passport sharing + view history ----------

export async function createPassportShare(tenantId: string, landlordId: string | null): Promise<PassportShare> {
  const db = client();
  const { data, error } = await db.from("passport_shares").insert({ tenant_id: tenantId, landlord_id: landlordId }).select().single();
  if (error) throw new ApiError(error.message);
  return data as PassportShare;
}

export async function listPassportShares(tenantId: string): Promise<PassportShare[]> {
  const db = client();
  const { data, error } = await db.from("passport_shares").select("*").eq("tenant_id", tenantId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PassportShare[];
}

export async function revokePassportShare(shareId: string): Promise<void> {
  const db = client();
  await db.from("passport_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId);
}

export async function recordPassportView(tenantId: string, viewerLandlordId: string): Promise<void> {
  const db = client();
  await db.from("passport_views").insert({ tenant_id: tenantId, viewer_landlord_id: viewerLandlordId });
}

export async function listPassportViews(tenantId: string): Promise<PassportView[]> {
  const db = client();
  const { data, error } = await db.from("passport_views").select("*").eq("tenant_id", tenantId).order("viewed_at", { ascending: false });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PassportView[];
}

// ---------- Landlord reviews ----------

export async function createLandlordReview(input: NewLandlordReview): Promise<LandlordReview> {
  const db = client();
  const overall = (input.communication_rating + input.maintenance_rating + input.accuracy_rating + input.professionalism_rating + input.move_in_rating) / 5;
  const { data, error } = await db
    .from("landlord_reviews")
    .insert({ ...input, overall_rating: Math.round(overall * 10) / 10 })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as LandlordReview;
}

export async function listLandlordReviews(landlordId: string): Promise<LandlordReview[]> {
  const db = client();
  const { data, error } = await db.from("landlord_reviews").select("*").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as LandlordReview[];
}

// ---------- Subscription plans (admin-configurable pricing) ----------

export async function listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const db = client();
  const { data, error } = await db.from("subscription_plans").select("*").eq("active", true);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as SubscriptionPlan[];
}

export async function updateSubscriptionPlan(tier: SubscriptionTier, patch: Partial<SubscriptionPlan>): Promise<void> {
  const db = client();
  unwrap(await db.from("subscription_plans").update({ ...patch, updated_at: new Date().toISOString() }).eq("tier", tier));
}

// ---------- Notifications ----------

export async function listNotifications(userId: string): Promise<Notification[]> {
  const db = client();
  const { data, error } = await db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const db = client();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
}

// Inserts a notification of `type` for `userId` only if one doesn't already
// exist — used for one-time nudges (e.g. "you may now qualify for Perfect
// Rent™") that shouldn't repeat every time the triggering page loads.
export async function notifyOnce(userId: string, type: string, body: string): Promise<void> {
  const db = client();
  const { data: existing } = await db.from("notifications").select("id").eq("user_id", userId).eq("type", type).maybeSingle();
  if (existing) return;
  await notify(userId, type, body);
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

// ---------- Perfect Rent™ ----------

export async function listRentIncentives(propertyId: string): Promise<RentIncentive[]> {
  const db = client();
  const { data, error } = await db.from("rent_incentives").select("*").eq("property_id", propertyId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as RentIncentive[];
}

export async function upsertRentIncentive(
  propertyId: string,
  type: IncentiveType,
  patch: Partial<Pick<RentIncentive, "discount_cents" | "enabled" | "requires_lease_months" | "funded_by">>,
): Promise<RentIncentive> {
  const db = client();
  const { data: existing } = await db.from("rent_incentives").select("*").eq("property_id", propertyId).eq("type", type).maybeSingle();
  if (existing) {
    const { data, error } = await db
      .from("rent_incentives")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new ApiError(error.message);
    return data as RentIncentive;
  }
  const { data, error } = await db
    .from("rent_incentives")
    .insert({
      property_id: propertyId,
      type,
      discount_cents: patch.discount_cents ?? 0,
      enabled: patch.enabled ?? true,
      requires_lease_months: patch.requires_lease_months ?? null,
      funded_by: patch.funded_by ?? "landlord",
    })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as RentIncentive;
}

export async function listJurisdictionRules(): Promise<JurisdictionRule[]> {
  const db = client();
  const { data, error } = await db.from("jurisdiction_rules").select("*");
  if (error) throw new ApiError(error.message);
  return (data ?? []) as JurisdictionRule[];
}

export async function updateJurisdictionRule(state: string, incentiveType: IncentiveType, allowed: boolean): Promise<void> {
  const db = client();
  const { data: existing } = await db.from("jurisdiction_rules").select("id").eq("state", state).eq("incentive_type", incentiveType).maybeSingle();
  if (existing) {
    await db.from("jurisdiction_rules").update({ allowed, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await db.from("jurisdiction_rules").insert({ state, incentive_type: incentiveType, allowed });
  }
}

export async function setAutoPaymentEnrollment(tenantId: string, enrolled: boolean): Promise<void> {
  const db = client();
  await db.from("tenants").update({ auto_payment_enrolled: enrolled }).eq("user_id", tenantId);
}

// ---------- Perfect Pay™ ----------

export async function recordPayment(
  landlordId: string,
  tenantId: string,
  propertyId: string,
  periodStart: string,
  status: PaymentStatus,
): Promise<PaymentVerification> {
  const db = client();
  const { data, error } = await db
    .from("payment_verifications")
    .upsert(
      { tenant_id: tenantId, property_id: propertyId, landlord_id: landlordId, period_start: periodStart, status, verified_at: new Date().toISOString() },
      { onConflict: "tenant_id,property_id,period_start" },
    )
    .select()
    .single();
  if (error) throw new ApiError(error.message);

  if (status === "on_time") {
    const { data: history } = await db.from("payment_verifications").select("period_start, status").eq("tenant_id", tenantId);
    const streak = computeOnTimeStreak((history ?? []) as Pick<PaymentVerification, "period_start" | "status">[]);
    const { data: milestone } = await db.from("perfect_pay_milestones").select("*").eq("consecutive_payments_required", streak).maybeSingle();
    if (milestone && streak > 0) {
      const levelLabel = `${milestone.level[0].toUpperCase()}${milestone.level.slice(1)}`;
      await db.from("reward_events").insert({
        tenant_id: tenantId,
        type: "perfect_pay_milestone",
        body: `🏆 Perfect Pay milestone! You've completed ${streak} verified on-time rent payments — Perfect Pay ${levelLabel} achieved.`,
      });
      await notify(tenantId, "perfect_pay_milestone", `You've reached Perfect Pay ${levelLabel}!`);
    }
  }

  return data as PaymentVerification;
}

export async function listPaymentVerificationsForTenant(tenantId: string): Promise<PaymentVerification[]> {
  const db = client();
  const { data, error } = await db.from("payment_verifications").select("*").eq("tenant_id", tenantId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PaymentVerification[];
}

export async function listPaymentVerificationsForLandlord(landlordId: string): Promise<PaymentVerification[]> {
  const db = client();
  const { data, error } = await db.from("payment_verifications").select("*").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PaymentVerification[];
}

export async function listPerfectPayMilestones(): Promise<PerfectPayMilestone[]> {
  const db = client();
  const { data, error } = await db.from("perfect_pay_milestones").select("*");
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PerfectPayMilestone[];
}

export async function getCurrentRentalForTenant(tenantId: string): Promise<CurrentRental | null> {
  const db = client();
  const { data: approved } = await db
    .from("applications")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!approved) return null;
  const property = await getProperty((approved as Application).property_id);
  if (!property) return null;
  return { application: approved as Application, property };
}

// ---------- Perfect Pay™ Autopay (simulated payment provider) ----------

export async function setTenantPaymentSetup(
  tenantId: string,
  input: { paymentMethodType: PaymentMethodType; last4: string; autopayDay: number },
): Promise<void> {
  const db = client();
  await db
    .from("tenants")
    .update({ payment_method_type: input.paymentMethodType, payment_method_last4: input.last4, autopay_day: input.autopayDay })
    .eq("user_id", tenantId);
}

export async function getLandlordPayoutAccount(landlordId: string): Promise<LandlordPayoutAccount> {
  const db = client();
  const { data } = await db.from("landlord_payout_accounts").select("*").eq("landlord_id", landlordId).maybeSingle();
  return (
    (data as LandlordPayoutAccount | null) ?? {
      landlord_id: landlordId,
      connected: false,
      last4: null,
      payout_schedule: "monthly",
      connected_at: null,
    }
  );
}

export async function connectLandlordPayoutAccount(landlordId: string, last4: string): Promise<void> {
  const db = client();
  await db
    .from("landlord_payout_accounts")
    .upsert({ landlord_id: landlordId, connected: true, last4, connected_at: new Date().toISOString() }, { onConflict: "landlord_id" });
}

export async function updateLandlordPayoutSchedule(landlordId: string, schedule: PayoutSchedule): Promise<void> {
  const db = client();
  await db.from("landlord_payout_accounts").update({ payout_schedule: schedule }).eq("landlord_id", landlordId);
}

export async function getPlatformFeeConfig(): Promise<PlatformFeeConfig> {
  const db = client();
  const { data, error } = await db.from("platform_fee_config").select("*").eq("id", 1).single();
  if (error) throw new ApiError(error.message);
  return data as PlatformFeeConfig;
}

export async function updatePlatformFeeConfig(patch: Partial<Omit<PlatformFeeConfig, "updated_at">>): Promise<void> {
  const db = client();
  await db.from("platform_fee_config").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
}

export async function listLandlordTenantAutopayStatus(landlordId: string): Promise<TenantAutopayStatus[]> {
  const db = client();
  const { data, error } = await db.from("landlord_visible_autopay").select("tenant_id, auto_payment_enrolled").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  return (data ?? []).map((row) => ({ tenantId: row.tenant_id as string, autoPaymentEnrolled: Boolean(row.auto_payment_enrolled) }));
}

export async function updatePerfectPayMilestone(level: PerfectPayLevel, consecutivePaymentsRequired: number): Promise<void> {
  const db = client();
  await db.from("perfect_pay_milestones").update({ consecutive_payments_required: consecutivePaymentsRequired }).eq("level", level);
}

export async function listRewardEvents(tenantId: string): Promise<RewardEvent[]> {
  const db = client();
  const { data, error } = await db.from("reward_events").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as RewardEvent[];
}

// ---------- Perfect Partners™ (advertising & monetization) ----------
// Money changes visibility only — nothing here ever writes to
// tenant_matches or reads scoreMatch's inputs. See src/lib/perfectPartners/engine.ts.

export async function getAdFrequencyRules(): Promise<AdFrequencyRules> {
  const db = client();
  const { data, error } = await db.from("ad_frequency_rules").select("*").eq("id", 1).single();
  if (error) throw new ApiError(error.message);
  return data as AdFrequencyRules;
}

export async function updateAdFrequencyRules(patch: Partial<AdFrequencyRules>): Promise<void> {
  const db = client();
  await db.from("ad_frequency_rules").update(patch).eq("id", 1);
}

// Approved + currently date-active sponsored_property campaigns — RLS
// (ad_campaigns_public_read_active) already restricts this to exactly that
// set for any caller, so no extra filtering is needed here.
export async function listActiveSponsoredPropertyCampaigns(): Promise<AdCampaign[]> {
  const db = client();
  const { data, error } = await db.from("ad_campaigns").select("*").eq("campaign_type", "sponsored_property").eq("status", "approved");
  if (error) throw new ApiError(error.message);
  return (data ?? []) as AdCampaign[];
}

export async function listPerfectPartners(onlyActive = true): Promise<PerfectPartner[]> {
  const db = client();
  let query = db.from("perfect_partners").select("*");
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as PerfectPartner[];
}

export async function listPartnerOffers(partnerId?: string, onlyActive = true): Promise<PartnerOffer[]> {
  const db = client();
  let query = db.from("partner_offers").select("*");
  if (partnerId) query = query.eq("partner_id", partnerId);
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new ApiError(error.message);
  const now = Date.now();
  return ((data ?? []) as PartnerOffer[]).filter((o) => !onlyActive || !o.expires_at || new Date(o.expires_at).getTime() >= now);
}

export async function recordAdImpression(kind: "campaign" | "offer", id: string, placement: string): Promise<void> {
  const db = client();
  await db.from("ad_impressions").insert({ campaign_id: kind === "campaign" ? id : null, offer_id: kind === "offer" ? id : null, placement });
}

export async function recordAdClick(kind: "campaign" | "offer", id: string, placement: string): Promise<void> {
  const db = client();
  await db.from("ad_clicks").insert({ campaign_id: kind === "campaign" ? id : null, offer_id: kind === "offer" ? id : null, placement });
}

export async function redeemPartnerOffer(tenantId: string, offerId: string): Promise<OfferRedemption> {
  const db = client();
  const { data: existing } = await db.from("offer_redemptions").select("*").eq("offer_id", offerId).eq("tenant_id", tenantId).maybeSingle();
  if (existing) return existing as OfferRedemption;
  await recordAdClick("offer", offerId, "partner_offer");
  const { data, error } = await db.from("offer_redemptions").insert({ offer_id: offerId, tenant_id: tenantId }).select().single();
  if (error) throw new ApiError(error.message);
  return data as OfferRedemption;
}

// ---------- Landlord: promote a property (Sponsored Property) ----------

export async function listAdPackages(campaignType?: CampaignType, onlyActive = true): Promise<AdPackage[]> {
  const db = client();
  let query = db.from("ad_packages").select("*");
  if (campaignType) query = query.eq("campaign_type", campaignType);
  if (onlyActive) query = query.eq("active", true);
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw new ApiError(error.message);
  return (data ?? []) as AdPackage[];
}

// Lazily creates the one advertiser row a landlord needs to self-promote —
// there's no separate third-party advertiser signup flow in this pass.
export async function getOrCreateAdvertiserForLandlord(landlordId: string): Promise<Advertiser> {
  const db = client();
  const { data: existing } = await db.from("advertisers").select("*").eq("owner_landlord_id", landlordId).maybeSingle();
  if (existing) return existing as Advertiser;
  const { data: landlord } = await db.from("landlords").select("company_name").eq("user_id", landlordId).maybeSingle();
  const { data, error } = await db
    .from("advertisers")
    .insert({ name: landlord?.company_name ?? "Landlord promotion", category: "real_estate", owner_landlord_id: landlordId })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as Advertiser;
}

export async function createSponsoredPropertyCampaign(landlordId: string, propertyId: string, packageId: string): Promise<AdCampaign> {
  const advertiser = await getOrCreateAdvertiserForLandlord(landlordId);
  const db = client();
  const { data: property } = await db.from("properties").select("address, city, state, zip").eq("id", propertyId).maybeSingle();
  const { data, error } = await db
    .from("ad_campaigns")
    .insert({
      advertiser_id: advertiser.id,
      campaign_type: "sponsored_property",
      status: "pending_review",
      property_id: propertyId,
      landlord_id: landlordId,
      package_id: packageId,
      target_city: property?.city ?? null,
      target_state: property?.state ?? null,
      target_zip: property?.zip ?? null,
      headline: property?.address ?? "Sponsored listing",
      cta_label: "View Listing",
    })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data as AdCampaign;
}

export async function listCampaignsForLandlord(landlordId: string): Promise<AdCampaign[]> {
  const db = client();
  const { data, error } = await db.from("ad_campaigns").select("*").eq("landlord_id", landlordId);
  if (error) throw new ApiError(error.message);
  return (data ?? []) as AdCampaign[];
}

export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const db = client();
  const [impressions, clicks, campaign] = await Promise.all([
    db.from("ad_impressions").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    db.from("ad_clicks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    db.from("ad_campaigns").select("property_id").eq("id", campaignId).maybeSingle(),
  ]);
  let applications = 0;
  if (campaign.data?.property_id) {
    const { count } = await db.from("applications").select("id", { count: "exact", head: true }).eq("property_id", campaign.data.property_id);
    applications = count ?? 0;
  }
  return { impressions: impressions.count ?? 0, clicks: clicks.count ?? 0, leads: clicks.count ?? 0, applications };
}

// ---------- Admin: Perfect Partners™ management ----------

export async function listCampaignsForReview(status?: CampaignStatus): Promise<AdCampaign[]> {
  const db = client();
  let query = db.from("ad_campaigns").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new ApiError(error.message);
  return (data ?? []) as AdCampaign[];
}

// Approving a paid (package_id set) campaign records a real
// ad_revenue_events row from the package's real configured price — never a
// fabricated number — and sets a real starts_at/ends_at window from the
// package's duration. No card is ever charged (see README).
export async function reviewCampaign(campaignId: string, decision: "approved" | "rejected", rejectionReason?: string): Promise<void> {
  const db = client();
  const now = new Date();
  if (decision === "rejected") {
    await db.from("ad_campaigns").update({ status: "rejected", reviewed_at: now.toISOString(), rejection_reason: rejectionReason ?? null }).eq("id", campaignId);
    return;
  }
  const { data: campaign } = await db.from("ad_campaigns").select("package_id").eq("id", campaignId).maybeSingle();
  const pkg = campaign?.package_id ? (await db.from("ad_packages").select("*").eq("id", campaign.package_id).maybeSingle()).data : null;
  const endsAt = pkg ? new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000).toISOString() : null;
  await db.from("ad_campaigns").update({ status: "approved", reviewed_at: now.toISOString(), rejection_reason: null, starts_at: now.toISOString(), ends_at: endsAt }).eq("id", campaignId);
  if (pkg) {
    await db.from("ad_revenue_events").insert({ campaign_id: campaignId, amount_cents: pkg.price_cents });
  }
}

export async function setCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
  const db = client();
  await db.from("ad_campaigns").update({ status }).eq("id", campaignId);
}

export async function updateAdPackage(id: string, patch: Partial<Pick<AdPackage, "name" | "duration_days" | "price_cents" | "active">>): Promise<void> {
  const db = client();
  await db.from("ad_packages").update(patch).eq("id", id);
}

export async function createPerfectPartner(input: Omit<PerfectPartner, "id">): Promise<PerfectPartner> {
  const db = client();
  const { data, error } = await db.from("perfect_partners").insert(input).select().single();
  if (error) throw new ApiError(error.message);
  return data as PerfectPartner;
}

export async function updatePerfectPartner(id: string, patch: Partial<Omit<PerfectPartner, "id">>): Promise<void> {
  const db = client();
  await db.from("perfect_partners").update(patch).eq("id", id);
}

export async function createPartnerOffer(input: Omit<PartnerOffer, "id">): Promise<PartnerOffer> {
  const db = client();
  const { data, error } = await db.from("partner_offers").insert(input).select().single();
  if (error) throw new ApiError(error.message);
  return data as PartnerOffer;
}

export async function updatePartnerOffer(id: string, patch: Partial<Omit<PartnerOffer, "id">>): Promise<void> {
  const db = client();
  await db.from("partner_offers").update(patch).eq("id", id);
}

export async function getAdvertisingRevenue(): Promise<AdvertisingRevenue> {
  const db = client();
  const { data, error } = await db.from("ad_revenue_events").select("amount_cents, created_at");
  if (error) throw new ApiError(error.message);
  const rows = (data ?? []) as { amount_cents: number; created_at: string }[];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sumSince = (cutoffMs: number) => rows.filter((r) => new Date(r.created_at).getTime() >= cutoffMs).reduce((sum, r) => sum + r.amount_cents, 0);
  return {
    todayCents: sumSince(now - day),
    weekCents: sumSince(now - 7 * day),
    monthCents: sumSince(now - 30 * day),
    yearCents: sumSince(now - 365 * day),
    totalCents: rows.reduce((sum, r) => sum + r.amount_cents, 0),
  };
}

// ---------- Admin ----------
// Reads here rely on RLS same as everywhere else — a non-admin caller simply
// gets zero rows back from subscription_plans writes (blocked) and reduced
// visibility on tables scoped to their own data, so this never needs a
// separate "is this an admin" branch in application code.

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = client();
  const [tenants, landlords, properties, applications, shares, plans, subscriptions, incentives, payments] = await Promise.all([
    db.from("tenants").select("user_id", { count: "exact", head: true }),
    db.from("landlords").select("user_id, identity_verified, contact_verified, business_verified"),
    db.from("properties").select("id", { count: "exact", head: true }),
    db.from("applications").select("id", { count: "exact", head: true }),
    db.from("passport_shares").select("id", { count: "exact", head: true }),
    db.from("subscription_plans").select("tier, price_cents"),
    db.from("subscriptions").select("tier, status"),
    db.from("rent_incentives").select("property_id, discount_cents, enabled"),
    db.from("payment_verifications").select("tenant_id, status"),
  ]);

  const { data: profileRows } = await db.from("tenant_public_profile").select("*");
  const rentalReadyTenants = (profileRows ?? []).filter(
    (r) =>
      r.identity_status === "verified" &&
      r.income_status === "verified" &&
      r.employment_status === "verified" &&
      r.rental_history_verified &&
      r.credit_status === "verified" &&
      r.background_status === "verified" &&
      r.eviction_status === "verified" &&
      r.references_verified,
  ).length;

  const priceByTier = new Map((plans.data ?? []).map((p) => [p.tier, p.price_cents]));
  const mrrCents = (subscriptions.data ?? [])
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (priceByTier.get(s.tier) ?? 0), 0);

  const activeIncentives = (incentives.data ?? []).filter((i) => i.enabled);
  const propertiesWithIncentives = new Set(activeIncentives.map((i) => i.property_id)).size;
  const avgDiscountCents = activeIncentives.length
    ? Math.round(activeIncentives.reduce((sum, i) => sum + i.discount_cents, 0) / activeIncentives.length)
    : 0;
  const paymentRows = payments.data ?? [];
  const verifiedPaymentTenants = new Set(paymentRows.map((p) => p.tenant_id)).size;
  const totalOnTimePayments = paymentRows.filter((p) => p.status === "on_time").length;
  const { count: rewardEventsCount } = await db.from("reward_events").select("id", { count: "exact", head: true });

  const [campaigns, partnersCount, redemptionsCount] = await Promise.all([
    db.from("ad_campaigns").select("status, starts_at, ends_at"),
    db.from("perfect_partners").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("offer_redemptions").select("id", { count: "exact", head: true }),
  ]);
  const nowMs = Date.now();
  const campaignRows = (campaigns.data ?? []) as { status: string; starts_at: string | null; ends_at: string | null }[];
  const activeCampaignsCount = campaignRows.filter(
    (c) =>
      c.status === "approved" &&
      (!c.starts_at || new Date(c.starts_at).getTime() <= nowMs) &&
      (!c.ends_at || new Date(c.ends_at).getTime() >= nowMs),
  ).length;
  const pendingReviewCampaignsCount = campaignRows.filter((c) => c.status === "pending_review").length;

  const [autopayTenants, payoutAccounts] = await Promise.all([
    db.from("tenants").select("auto_payment_enrolled"),
    db.from("landlord_payout_accounts").select("connected"),
  ]);
  const autopayEnrolledTenants = (autopayTenants.data ?? []).filter((t) => t.auto_payment_enrolled).length;
  const autopayRatePercent = tenants.count ? Math.round((autopayEnrolledTenants / tenants.count) * 100) : 0;
  const connectedPayoutLandlords = (payoutAccounts.data ?? []).filter((a) => a.connected).length;

  return {
    totalTenants: tenants.count ?? 0,
    rentalReadyTenants,
    totalLandlords: (landlords.data ?? []).length,
    verifiedLandlords: (landlords.data ?? []).filter((l) => l.identity_verified && l.contact_verified && l.business_verified).length,
    totalProperties: properties.count ?? 0,
    totalApplications: applications.count ?? 0,
    passportShares: shares.count ?? 0,
    mrrCents,
    activeIncentivesCount: activeIncentives.length,
    propertiesWithIncentives,
    avgDiscountCents,
    verifiedPaymentTenants,
    totalOnTimePayments,
    rewardEventsCount: rewardEventsCount ?? 0,
    activeCampaignsCount,
    pendingReviewCampaignsCount,
    perfectPartnersCount: partnersCount.count ?? 0,
    partnerOfferRedemptionsCount: redemptionsCount.count ?? 0,
    autopayEnrolledTenants,
    autopayRatePercent,
    connectedPayoutLandlords,
  };
}

// ---------- Users ----------

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = client();
  const { data } = await db.from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

// Own auto-pay enrollment, read directly off `tenants` (RLS: tenant_id =
// auth.uid() only) — unlike TenantSummary (sourced from the
// marketplace-safe view, which always reports false here), this reflects
// the tenant's actual setting for their own real Perfect Rent™ calculator.
export async function getOwnAutoPaymentEnrollment(tenantId: string): Promise<boolean> {
  const db = client();
  const { data } = await db.from("tenants").select("auto_payment_enrolled").eq("user_id", tenantId).maybeSingle();
  return data?.auto_payment_enrolled ?? false;
}

export async function getOwnPaymentSetup(
  tenantId: string,
): Promise<Pick<Tenant, "auto_payment_enrolled" | "payment_method_type" | "payment_method_last4" | "autopay_day">> {
  const db = client();
  const { data } = await db
    .from("tenants")
    .select("auto_payment_enrolled, payment_method_type, payment_method_last4, autopay_day")
    .eq("user_id", tenantId)
    .maybeSingle();
  return {
    auto_payment_enrolled: data?.auto_payment_enrolled ?? false,
    payment_method_type: data?.payment_method_type ?? null,
    payment_method_last4: data?.payment_method_last4 ?? null,
    autopay_day: data?.autopay_day ?? null,
  };
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
