import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo } from "@/components/Logo";
import { MarketingNavbar } from "@/components/MarketingNavbar";

// Order matches how a tenant actually uses the app day to day: the rental
// search/application flow first, the two inboxes (Messages, Landlord
// Interest) next, then the supporting Perfect___ features. Perfect10ant
// Verified™ and Perfect10ant Plus™ (paid upsells) live in the account menu
// instead of here, so the everyday tab bar stays focused on
// rentals/applications/search — not on upselling a profile that's already
// been created.
const TENANT_NAV_ITEMS = [
  { to: "/home", label: "Home" },
  { to: "/search", label: "Search" },
  { to: "/saved", label: "Saved" },
  { to: "/applications", label: "Applications" },
  { to: "/messages", label: "Messages" },
  { to: "/invitations", label: "Landlord Interest" },
  { to: "/passport", label: "My Passport" },
  { to: "/matches", label: "Perfect Match™" },
  { to: "/perfect-pay", label: "Perfect Pay™" },
  { to: "/partners", label: "Perfect Partners™" },
  { to: "/rewards", label: "Rewards" },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu on every navigation instead of leaving it open
  // over the next page.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!user) return <MarketingNavbar />;

  const navLinkClass =
    "inline-flex items-center whitespace-nowrap rounded-md border border-slate-200 px-2 py-1 text-[13px] font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700";
  const mobileLinkClass =
    "block rounded-md px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-700";

  const landlordNavItems = [
    { to: "/landlord", label: "Listings" },
    { to: "/landlord/tenants", label: "My Tenants" },
    { to: "/landlord/rent-collection", label: "Rent Collection" },
    { to: "/landlord/payouts", label: "Payouts" },
    { to: "/landlord/marketplace", label: "Tenant Marketplace" },
    { to: "/landlord/interests", label: "Tenant Interest" },
    { to: "/landlord/saved", label: "Saved tenants" },
    { to: "/messages", label: "Messages" },
    { to: "/pricing", label: "Billing" },
    ...(user.is_admin ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const navItems = user.role === "tenant" ? TENANT_NAV_ITEMS : landlordNavItems;

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link to={user.role === "landlord" ? "/landlord" : "/home"} className="flex-none">
          <Logo className="h-12 w-auto" />
        </Link>
        <nav className="hidden flex-nowrap items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-none items-center gap-2 md:gap-3">
          <NotificationBell />
          <AccountMenu />
          <Button variant="secondary" className="hidden md:inline-flex" onClick={handleSignOut}>
            Sign out
          </Button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-slate-200 text-ink-700 md:hidden"
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
                <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-slate-200 px-2 py-2 md:hidden">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={mobileLinkClass}>
              {item.label}
            </Link>
          ))}
          <button onClick={handleSignOut} className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-bold text-red-600 transition hover:bg-red-50">
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
