import { Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RequireRole } from "@/components/RequireRole";
import { RequireAdmin } from "@/components/RequireAdmin";
import { Landing } from "@/pages/Landing";
import { ForLandlords } from "@/pages/ForLandlords";
import { About } from "@/pages/About";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { ConversationList, ConversationThread } from "@/pages/Messages";
import { TenantHome } from "@/pages/tenant/Home";
import { TenantOnboarding } from "@/pages/tenant/Onboarding";
import { TenantSearch } from "@/pages/tenant/Search";
import { TenantMatches } from "@/pages/tenant/Matches";
import { PropertyDetail } from "@/pages/tenant/PropertyDetail";
import { TenantApplications } from "@/pages/tenant/Applications";
import { TenantSaved } from "@/pages/tenant/Saved";
import { TenantPassport } from "@/pages/tenant/Passport";
import { TenantVerificationCenter } from "@/pages/tenant/VerificationCenter";
import { TenantVerified } from "@/pages/tenant/Verified";
import { TenantPlus } from "@/pages/tenant/Plus";
import { TenantInvitations } from "@/pages/tenant/Invitations";
import { TenantPerfectPay } from "@/pages/tenant/PerfectPay";
import { PerfectPaySetup } from "@/pages/tenant/PerfectPaySetup";
import { TenantRewards } from "@/pages/tenant/Rewards";
import { Partners } from "@/pages/tenant/Partners";
import { LandlordDashboard } from "@/pages/landlord/Dashboard";
import { LandlordRentCollection } from "@/pages/landlord/RentCollection";
import { LandlordPayouts } from "@/pages/landlord/Payouts";
import { LandlordPerfectPaySettings } from "@/pages/landlord/PerfectPaySettings";
import { LandlordPropertyForm } from "@/pages/landlord/PropertyForm";
import { LandlordApplicants } from "@/pages/landlord/Applicants";
import { LandlordMyTenants } from "@/pages/landlord/MyTenants";
import { LandlordSavedTenants } from "@/pages/landlord/SavedTenants";
import { LandlordPricing } from "@/pages/landlord/Pricing";
import { LandlordMarketplace } from "@/pages/landlord/Marketplace";
import { LandlordTenantPassportView } from "@/pages/landlord/TenantPassportView";
import { LandlordInterests } from "@/pages/landlord/Interests";
import { AdminDashboard } from "@/pages/admin/Admin";

function App() {
  return (
    <div className="min-h-full">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
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
      </Routes>
    </div>
  );
}

export default App;
