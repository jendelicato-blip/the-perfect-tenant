import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { NotificationBell } from "@/components/NotificationBell";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const tenantLinks = (
    <>
      <Link to="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900">Search</Link>
      <Link to="/matches" className="text-sm font-medium text-slate-600 hover:text-slate-900">Perfect Match™</Link>
      <Link to="/applications" className="text-sm font-medium text-slate-600 hover:text-slate-900">Applications</Link>
      <Link to="/invitations" className="text-sm font-medium text-slate-600 hover:text-slate-900">Landlord Interest</Link>
      <Link to="/saved" className="text-sm font-medium text-slate-600 hover:text-slate-900">Saved</Link>
      <Link to="/messages" className="text-sm font-medium text-slate-600 hover:text-slate-900">Messages</Link>
      <Link to="/passport" className="text-sm font-medium text-slate-600 hover:text-slate-900">My Passport</Link>
    </>
  );

  const landlordLinks = (
    <>
      <Link to="/landlord" className="text-sm font-medium text-slate-600 hover:text-slate-900">Listings</Link>
      <Link to="/landlord/marketplace" className="text-sm font-medium text-slate-600 hover:text-slate-900">Tenant Marketplace</Link>
      <Link to="/landlord/interests" className="text-sm font-medium text-slate-600 hover:text-slate-900">Tenant Interest</Link>
      <Link to="/landlord/saved" className="text-sm font-medium text-slate-600 hover:text-slate-900">Saved tenants</Link>
      <Link to="/messages" className="text-sm font-medium text-slate-600 hover:text-slate-900">Messages</Link>
      <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">Billing</Link>
      {user?.is_admin && <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">Admin</Link>}
    </>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-slate-900">
          The Perfect Tennant<span className="align-super text-xs">™</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {user?.role === "tenant" && tenantLinks}
          {user?.role === "landlord" && landlordLinks}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
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
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="secondary">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
