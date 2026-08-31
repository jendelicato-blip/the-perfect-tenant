import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";
import { Logo } from "@/components/Logo";
import { MarketingNavbar } from "@/components/MarketingNavbar";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return <MarketingNavbar />;

  const navLinkClass =
    "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-brand-700 hover:shadow-sm";

  const tenantLinks = (
    <>
      <Link to="/search" className={navLinkClass}>Search</Link>
      <Link to="/matches" className={navLinkClass}>Perfect Match™</Link>
      <Link to="/applications" className={navLinkClass}>Applications</Link>
      <Link to="/invitations" className={navLinkClass}>Landlord Interest</Link>
      <Link to="/saved" className={navLinkClass}>Saved</Link>
      <Link to="/messages" className={navLinkClass}>Messages</Link>
      <Link to="/passport" className={navLinkClass}>My Passport</Link>
      <Link to="/perfect-pay" className={navLinkClass}>Perfect Pay™</Link>
      <Link to="/rewards" className={navLinkClass}>Rewards</Link>
      <Link to="/partners" className={navLinkClass}>Perfect Partners™</Link>
    </>
  );

  const landlordLinks = (
    <>
      <Link to="/landlord" className={navLinkClass}>Listings</Link>
      <Link to="/landlord/marketplace" className={navLinkClass}>Tenant Marketplace</Link>
      <Link to="/landlord/interests" className={navLinkClass}>Tenant Interest</Link>
      <Link to="/landlord/saved" className={navLinkClass}>Saved tenants</Link>
      <Link to="/messages" className={navLinkClass}>Messages</Link>
      <Link to="/pricing" className={navLinkClass}>Billing</Link>
      {user.is_admin && <Link to="/admin" className={navLinkClass}>Admin</Link>}
    </>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex-none">
          <Logo className="h-9 w-auto" />
        </Link>
        <nav className="hidden flex-wrap items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex">
          {user.role === "tenant" && tenantLinks}
          {user.role === "landlord" && landlordLinks}
        </nav>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
