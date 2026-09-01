import type {
  AdCampaign,
  AdClick,
  AdFrequencyRules,
  AdImpression,
  AdPackage,
  AdRevenueEvent,
  Advertiser,
  Application,
  BackgroundScreening,
  Conversation,
  CreditScreening,
  Dispute,
  Employment,
  EvictionScreening,
  IdentityVerification,
  IncomeVerification,
  JurisdictionRule,
  Landlord,
  LandlordPayoutAccount,
  LandlordReview,
  Message,
  Notification,
  OfferRedemption,
  PartnerOffer,
  PassportShare,
  PassportView,
  PaymentRefund,
  PaymentVerification,
  PerfectPartner,
  PerfectPayMilestone,
  PlatformFeeConfig,
  Property,
  PropertyPhoto,
  RentIncentive,
  RentalHistoryEntry,
  RewardEvent,
  SavedProperty,
  SavedTenant,
  Subscription,
  SubscriptionPlan,
  Tenant,
  TenantArea,
  TenantInterest,
  TenantInvitation,
  TenantPreferences,
  TenantReference,
  User,
  PlusMembershipConfig,
  TenantDocument,
  TenantPlusMembership,
  VerifiedPurchase,
  VerifiedTierConfig,
} from "@/types/domain";
import * as seed from "@/data/seed";

interface Db {
  users: User[];
  tenants: Tenant[];
  tenantPreferences: TenantPreferences[];
  tenantAreas: TenantArea[];
  identityVerification: IdentityVerification[];
  incomeVerification: IncomeVerification[];
  employment: Employment[];
  rentalHistory: RentalHistoryEntry[];
  tenantReferences: TenantReference[];
  creditScreenings: CreditScreening[];
  backgroundScreenings: BackgroundScreening[];
  evictionScreenings: EvictionScreening[];
  landlords: Landlord[];
  properties: Property[];
  propertyPhotos: PropertyPhoto[];
  applications: Application[];
  conversations: Conversation[];
  messages: Message[];
  savedProperties: SavedProperty[];
  savedTenants: SavedTenant[];
  subscriptions: Subscription[];
  subscriptionPlans: SubscriptionPlan[];
  tenantInvitations: TenantInvitation[];
  tenantInterests: TenantInterest[];
  passportShares: PassportShare[];
  passportViews: PassportView[];
  landlordReviews: LandlordReview[];
  rentIncentives: RentIncentive[];
  jurisdictionRules: JurisdictionRule[];
  paymentVerifications: PaymentVerification[];
  perfectPayMilestones: PerfectPayMilestone[];
  rewardEvents: RewardEvent[];
  notifications: Notification[];
  advertisers: Advertiser[];
  adPackages: AdPackage[];
  adCampaigns: AdCampaign[];
  perfectPartners: PerfectPartner[];
  partnerOffers: PartnerOffer[];
  offerRedemptions: OfferRedemption[];
  adImpressions: AdImpression[];
  adClicks: AdClick[];
  adRevenueEvents: AdRevenueEvent[];
  adFrequencyRules: AdFrequencyRules;
  landlordPayoutAccounts: LandlordPayoutAccount[];
  platformFeeConfig: PlatformFeeConfig;
  disputes: Dispute[];
  paymentRefunds: PaymentRefund[];
  verifiedTierConfig: VerifiedTierConfig;
  verifiedPurchases: VerifiedPurchase[];
  plusMembershipConfig: PlusMembershipConfig;
  tenantPlusMemberships: TenantPlusMembership[];
  tenantDocuments: TenantDocument[];
  passwords: Record<string, string>;
  currentUserId: string | null;
}

const STORAGE_KEY = "tpt.devstore.v8";

function freshDb(): Db {
  return {
    users: [...seed.seedUsers],
    tenants: [...seed.seedTenants],
    tenantPreferences: [...seed.seedTenantPreferences],
    tenantAreas: [...seed.seedTenantAreas],
    identityVerification: [...seed.seedIdentityVerification],
    incomeVerification: [...seed.seedIncomeVerification],
    employment: [...seed.seedEmployment],
    rentalHistory: [...seed.seedRentalHistory],
    tenantReferences: [...seed.seedTenantReferences],
    creditScreenings: [...seed.seedCreditScreenings],
    backgroundScreenings: [...seed.seedBackgroundScreenings],
    evictionScreenings: [...seed.seedEvictionScreenings],
    landlords: [...seed.seedLandlords],
    properties: [...seed.seedProperties],
    propertyPhotos: [...seed.seedPropertyPhotos],
    applications: [...seed.seedApplications],
    conversations: [...seed.seedConversations],
    messages: [...seed.seedMessages],
    savedProperties: [...seed.seedSavedProperties],
    savedTenants: [...seed.seedSavedTenants],
    subscriptions: [...seed.seedSubscriptions],
    subscriptionPlans: [...seed.seedSubscriptionPlans],
    tenantInvitations: [...seed.seedTenantInvitations],
    tenantInterests: [...seed.seedTenantInterests],
    passportShares: [...seed.seedPassportShares],
    passportViews: [...seed.seedPassportViews],
    landlordReviews: [...seed.seedLandlordReviews],
    rentIncentives: [...seed.seedRentIncentives],
    jurisdictionRules: [...seed.seedJurisdictionRules],
    paymentVerifications: [...seed.seedPaymentVerifications],
    perfectPayMilestones: [...seed.seedPerfectPayMilestones],
    rewardEvents: [...seed.seedRewardEvents],
    notifications: [],
    advertisers: [...seed.seedAdvertisers],
    adPackages: [...seed.seedAdPackages],
    adCampaigns: [...seed.seedAdCampaigns],
    perfectPartners: [...seed.seedPerfectPartners],
    partnerOffers: [...seed.seedPartnerOffers],
    offerRedemptions: [],
    adImpressions: [],
    adClicks: [],
    adRevenueEvents: [...seed.seedAdRevenueEvents],
    adFrequencyRules: { ...seed.seedAdFrequencyRules },
    landlordPayoutAccounts: [...seed.seedLandlordPayoutAccounts],
    platformFeeConfig: { ...seed.seedPlatformFeeConfig },
    disputes: [],
    paymentRefunds: [],
    verifiedTierConfig: { ...seed.seedVerifiedTierConfig },
    verifiedPurchases: [...seed.seedVerifiedPurchases],
    plusMembershipConfig: { ...seed.seedPlusMembershipConfig },
    tenantPlusMemberships: [...seed.seedTenantPlusMemberships],
    tenantDocuments: [],
    passwords: { ...seed.seedPasswords },
    currentUserId: null,
  };
}

let db: Db | null = null;

function load(): Db {
  if (db) return db;
  if (typeof localStorage === "undefined") {
    db = freshDb();
    return db;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    db = freshDb();
    persist();
    return db;
  }
  try {
    db = JSON.parse(raw) as Db;
  } catch {
    db = freshDb();
  }
  return db;
}

function persist() {
  if (!db || typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function getDb(): Db {
  return load();
}

export function mutate<T>(fn: (draft: Db) => T): T {
  const current = load();
  const result = fn(current);
  persist();
  return result;
}

export function resetDb() {
  db = freshDb();
  persist();
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
