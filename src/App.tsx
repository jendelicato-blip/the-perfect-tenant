import { lazy, Suspense, type ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RequireRole } from "@/components/RequireRole";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RootRoute } from "@/components/RootRoute";

// Route-level code splitting: each page ships in its own chunk instead of
// one ~700KB bundle every visitor downloads up front, most of it for pages
// their role can't even reach (a tenant never runs the landlord bundle, and
// vice versa). `lazyNamed` just adapts these pages' named exports to the
// default-export shape React.lazy requires.
function lazyNamed<P extends object>(factory: () => Promise<Record<string, ComponentType<P>>>, name: string) {
  return lazy(() => factory().then((m) => ({ default: m[name] })));
}

const ForLandlords = lazyNamed(() => import("@/pages/ForLandlords"), "ForLandlords");
const About = lazyNamed(() => import("@/pages/About"), "About");
const Login = lazyNamed(() => import("@/pages/Login"), "Login");
const Signup = lazyNamed(() => import("@/pages/Signup"), "Signup");
const ConversationList = lazyNamed(() => import("@/pages/Messages"), "ConversationList");
const ConversationThread = lazyNamed(() => import("@/pages/Messages"), "ConversationThread");
const TenantHome = lazyNamed(() => import("@/pages/tenant/Home"), "TenantHome");
const TenantOnboarding = lazyNamed(() => import("@/pages/tenant/Onboarding"), "TenantOnboarding");
const TenantSearch = lazyNamed(() => import("@/pages/tenant/Search"), "TenantSearch");
const TenantMatches = lazyNamed(() => import("@/pages/tenant/Matches"), "TenantMatches");
const PropertyDetail = lazyNamed(() => import("@/pages/tenant/PropertyDetail"), "PropertyDetail");
const TenantApplications = lazyNamed(() => import("@/pages/tenant/Applications"), "TenantApplications");
const TenantSaved = lazyNamed(() => import("@/pages/tenant/Saved"), "TenantSaved");
const TenantPassport = lazyNamed(() => import("@/pages/tenant/Passport"), "TenantPassport");
const TenantVerificationCenter = lazyNamed(() => import("@/pages/tenant/VerificationCenter"), "TenantVerificationCenter");
const TenantVerified = lazyNamed(() => import("@/pages/tenant/Verified"), "TenantVerified");
const TenantPlus = lazyNamed(() => import("@/pages/tenant/Plus"), "TenantPlus");
const TenantInvitations = lazyNamed(() => import("@/pages/tenant/Invitations"), "TenantInvitations");
const TenantPerfectPay = lazyNamed(() => import("@/pages/tenant/PerfectPay"), "TenantPerfectPay");
const PerfectPaySetup = lazyNamed(() => import("@/pages/tenant/PerfectPaySetup"), "PerfectPaySetup");
const TenantRewards = lazyNamed(() => import("@/pages/tenant/Rewards"), "TenantRewards");
const Partners = lazyNamed(() => import("@/pages/tenant/Partners"), "Partners");
const LandlordDashboard = lazyNamed(() => import("@/pages/landlord/Dashboard"), "LandlordDashboard");
const LandlordRentCollection = lazyNamed(() => import("@/pages/landlord/RentCollection"), "LandlordRentCollection");
const LandlordPayouts = lazyNamed(() => import("@/pages/landlord/Payouts"), "LandlordPayouts");
const LandlordPerfectPaySettings = lazyNamed(() => import("@/pages/landlord/PerfectPaySettings"), "LandlordPerfectPaySettings");
const LandlordPropertyForm = lazyNamed(() => import("@/pages/landlord/PropertyForm"), "LandlordPropertyForm");
const LandlordApplicants = lazyNamed(() => import("@/pages/landlord/Applicants"), "LandlordApplicants");
const LandlordMyTenants = lazyNamed(() => import("@/pages/landlord/MyTenants"), "LandlordMyTenants");
const LandlordSavedTenants = lazyNamed(() => import("@/pages/landlord/SavedTenants"), "LandlordSavedTenants");
const LandlordPricing = lazyNamed(() => import("@/pages/landlord/Pricing"), "LandlordPricing");
const LandlordMarketplace = lazyNamed(() => import("@/pages/landlord/Marketplace"), "LandlordMarketplace");
const LandlordTenantPassportView = lazyNamed(() => import("@/pages/landlord/TenantPassportView"), "LandlordTenantPassportView");
const LandlordInterests = lazyNamed(() => import("@/pages/landlord/Interests"), "LandlordInterests");
const AdminDashboard = lazyNamed(() => import("@/pages/admin/Admin"), "AdminDashboard");
const RentalAggregationAdmin = lazyNamed(() => import("@/pages/admin/RentalAggregation"), "RentalAggregationAdmin");

function RouteLoading() {
  return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;
}

function App() {
  return (
    <div className="min-h-full">
      <Navbar />
      <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/for-landlords" element={<ForLandlords />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/messages" element={<ConversationList />} />
        <Route path="/messages/:conversationId" element={<ConversationThread />} />

        <Route
          path="/home"
          element={
            <RequireRole role="tenant">
              <TenantHome />
            </RequireRole>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireRole role="tenant">
              <TenantOnboarding />
            </RequireRole>
          }
        />
        <Route
          path="/search"
          element={
            <RequireRole role="tenant">
              <TenantSearch />
            </RequireRole>
          }
        />
        <Route
          path="/matches"
          element={
            <RequireRole role="tenant">
              <TenantMatches />
            </RequireRole>
          }
        />
        <Route
          path="/applications"
          element={
            <RequireRole role="tenant">
              <TenantApplications />
            </RequireRole>
          }
        />
        <Route
          path="/invitations"
          element={
            <RequireRole role="tenant">
              <TenantInvitations />
            </RequireRole>
          }
        />
        <Route
          path="/saved"
          element={
            <RequireRole role="tenant">
              <TenantSaved />
            </RequireRole>
          }
        />
        <Route
          path="/passport"
          element={
            <RequireRole role="tenant">
              <TenantPassport />
            </RequireRole>
          }
        />
        <Route
          path="/verification"
          element={
            <RequireRole role="tenant">
              <TenantVerificationCenter />
            </RequireRole>
          }
        />
        <Route
          path="/verified"
          element={
            <RequireRole role="tenant">
              <TenantVerified />
            </RequireRole>
          }
        />
        <Route
          path="/plus"
          element={
            <RequireRole role="tenant">
              <TenantPlus />
            </RequireRole>
          }
        />
        <Route
          path="/perfect-pay"
          element={
            <RequireRole role="tenant">
              <TenantPerfectPay />
            </RequireRole>
          }
        />
        <Route
          path="/perfect-pay/setup"
          element={
            <RequireRole role="tenant">
              <PerfectPaySetup />
            </RequireRole>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireRole role="tenant">
              <TenantRewards />
            </RequireRole>
          }
        />
        <Route
          path="/partners"
          element={
            <RequireRole role="tenant">
              <Partners />
            </RequireRole>
          }
        />

        <Route
          path="/landlord"
          element={
            <RequireRole role="landlord">
              <LandlordDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/properties/new"
          element={
            <RequireRole role="landlord">
              <LandlordPropertyForm />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/properties/:id/edit"
          element={
            <RequireRole role="landlord">
              <LandlordPropertyForm />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/applicants/:propertyId"
          element={
            <RequireRole role="landlord">
              <LandlordApplicants />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/saved"
          element={
            <RequireRole role="landlord">
              <LandlordSavedTenants />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/tenants"
          element={
            <RequireRole role="landlord">
              <LandlordMyTenants />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/rent-collection"
          element={
            <RequireRole role="landlord">
              <LandlordRentCollection />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/perfect-pay-settings"
          element={
            <RequireRole role="landlord">
              <LandlordPerfectPaySettings />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/payouts"
          element={
            <RequireRole role="landlord">
              <LandlordPayouts />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/marketplace"
          element={
            <RequireRole role="landlord">
              <LandlordMarketplace />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/interests"
          element={
            <RequireRole role="landlord">
              <LandlordInterests />
            </RequireRole>
          }
        />
        <Route
          path="/landlord/tenants/:tenantId"
          element={
            <RequireRole role="landlord">
              <LandlordTenantPassportView />
            </RequireRole>
          }
        />
        <Route path="/pricing" element={<LandlordPricing />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/rental-aggregation"
          element={
            <RequireAdmin>
              <RentalAggregationAdmin />
            </RequireAdmin>
          }
        />
      </Routes>
      </Suspense>
    </div>
  );
}

export default App;
