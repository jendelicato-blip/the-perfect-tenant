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

  const tenantLinks = (
    <>
      <Link to="/search" className="text-sm font-medium text-ink-400 hover:text-brand-700">Search</Link>
      <Link to="/matches" className="text-sm font-medium text-ink-400 hover:text-brand-700">Perfect Match™</Link>
      <Link to="/applications" className="text-sm font-medium text-ink-400 hover:text-brand-700">Applications</Link>
      <Link to="/invitations" className="text-sm font-medium text-ink-400 hover:text-brand-700">Landlord Interest</Link>
      <Link to="/saved" className="text-sm font-medium text-ink-400 hover:text-brand-700">Saved</Link>
      <Link to="/messages" className="text-sm font-medium text-ink-400 hover:text-brand-700">Messages</Link>
      <Link to="/passport" className="text-sm font-medium text-ink-400 hover:text-brand-700">My Passport</Link>
    </>
  );

  const landlordLinks = (
    <>
      <Link to="/landlord" className="text-sm font-medium text-ink-400 hover:text-brand-700">Listings</Link>
      <Link to="/landlord/marketplace" className="text-sm font-medium text-ink-400 hover:text-brand-700">Tenant Marketplace</Link>
      <Link to="/landlord/interests" className="text-sm font-medium text-ink-400 hover:text-brand-700">Tenant Interest</Link>
      <Link to="/landlord/saved" className="text-sm font-medium text-ink-400 hover:text-brand-700">Saved tenants</Link>
      <Link to="/messages" className="text-sm font-medium text-ink-400 hover:text-brand-700">Messages</Link>
      <Link to="/pricing" className="text-sm font-medium text-ink-400 hover:text-brand-700">Billing</Link>
      {user.is_admin && <Link to="/admin" className="text-sm font-medium text-ink-400 hover:text-brand-700">Admin</Link>}
    </>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/">
          <Logo markClassName="h-8 w-8" className="text-base" />
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
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
