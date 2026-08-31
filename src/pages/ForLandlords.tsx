import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InlineLogo } from "@/components/Logo";

export function ForLandlords() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Stop Sorting Through Applications.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600 lg:mx-0">
            Find verified, rental-ready tenants who already match your property requirements.
          </p>
          <Link to="/signup?role=landlord">
            <Button className="mt-6">Get started</Button>
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl">
          <img
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80"
            alt="A well-kept rental property ready to list"
            className="h-72 w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Traditional process</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>100 applications</li>
            <li>↓ Manual screening</li>
            <li>↓ Income verification</li>
            <li>↓ Background checks</li>
            <li>↓ Reference calls</li>
            <li>↓ Hours of work</li>
          </ol>
        </Card>
        <Card className="p-6 ring-2 ring-brand-500">
          <h2 className="font-semibold text-slate-900"><InlineLogo className="h-6 w-auto" /></h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Property posted</li>
            <li>↓ Perfect Match™</li>
            <li>↓ Verified tenants</li>
            <li>↓ Invite to apply</li>
            <li>↓ Choose your tenant</li>
          </ol>
        </Card>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-center font-semibold text-slate-900">
          <InlineLogo className="h-6 w-auto" /> verifies both sides
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Tenant: "Is this landlord legitimate?"</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Landlord: "Is this tenant legitimate?"</p>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">More trust. Less guesswork. Better rentals.</p>
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          "Unlimited tenant search",
          "Perfect Match™ scoring",
          "New Tenant Alerts",
          "Saved searches & tenants",
          "Application management",
          "Priority support",
        ].map((f) => (
          <div key={f} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            ✓ {f}
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link to="/pricing" className="text-sm font-medium text-brand-600 hover:underline">
          See subscription tiers →
        </Link>
      </div>
    </div>
  );
}
