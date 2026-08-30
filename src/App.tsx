import { Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { RequireRole } from "@/components/RequireRole";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { ConversationList, ConversationThread } from "@/pages/Messages";
import { TenantOnboarding } from "@/pages/tenant/Onboarding";
import { TenantSearch } from "@/pages/tenant/Search";
import { TenantMatches } from "@/pages/tenant/Matches";
import { PropertyDetail } from "@/pages/tenant/PropertyDetail";
import { TenantApplications } from "@/pages/tenant/Applications";
import { TenantSaved } from "@/pages/tenant/Saved";
import { TenantProfile } from "@/pages/tenant/Profile";
import { LandlordDashboard } from "@/pages/landlord/Dashboard";
import { LandlordPropertyForm } from "@/pages/landlord/PropertyForm";
import { LandlordApplicants } from "@/pages/landlord/Applicants";
import { LandlordSavedTenants } from "@/pages/landlord/SavedTenants";
import { LandlordPricing } from "@/pages/landlord/Pricing";

function App() {
  return (
    <div className="min-h-full">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/messages" element={<ConversationList />} />
        <Route path="/messages/:conversationId" element={<ConversationThread />} />

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
          path="/saved"
          element={
            <RequireRole role="tenant">
              <TenantSaved />
            </RequireRole>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireRole role="tenant">
              <TenantProfile />
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
          path="/pricing"
          element={
            <RequireRole role="landlord">
              <LandlordPricing />
            </RequireRole>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
