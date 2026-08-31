import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

function NavDropdown({ label, items }: { label: string; items: { to: string; label: string }[] }) {
  return (
    <div className="group relative">
      <button className="flex items-center gap-1 text-sm font-medium text-ink-900 hover:text-brand-700">
        {label}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="mt-0.5">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full z-20 w-52 rounded-xl border border-slate-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MarketingNavbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/">
          <Logo className="h-11 w-auto" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <NavDropdown
            label="For Tenants"
            items={[
              { to: "/signup?role=tenant", label: "Create your Passport" },
              { to: "/#how-it-works", label: "How it works" },
            ]}
          />
          <NavDropdown
            label="For Landlords"
            items={[
              { to: "/for-landlords", label: "Why The Perfect10ant" },
              { to: "/signup?role=landlord", label: "Get started" },
            ]}
          />
          <Link to="/pricing" className="text-sm font-medium text-ink-900 hover:text-brand-700">
            Pricing
          </Link>
          <NavDropdown
            label="Resources"
            items={[{ to: "/#how-it-works", label: "How it works" }]}
          />
          <Link to="/about" className="text-sm font-medium text-ink-900 hover:text-brand-700">
            About Us
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-brand-700 hover:underline">
            Log In
          </Link>
          <Link to="/signup">
            <Button>Get Started Free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
