import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isSupabaseConfigured } from "@/lib/data/supabaseClient";

const STEPS = [
  "Create Your Profile",
  "Get Verified",
  "Become Rental Ready",
  "Get Matched",
  "Rent With Confidence",
];

export function Landing() {
  return (
    <div>
      {!isSupabaseConfigured && (
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Running in local dev mode — data is stored in your browser only (no Supabase project
            connected yet). Try the demo accounts on the login page.
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">The Verified Rental Network</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-5xl font-bold tracking-tight text-slate-900">
          The Perfect Tennant<span className="align-super text-2xl">™</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Get verified once. Find the right home. Help landlords find you.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup?role=tenant">
            <Button>I'm a Tenant</Button>
          </Link>
          <Link to="/signup?role=landlord">
            <Button variant="secondary">I'm a Landlord</Button>
          </Link>
        </div>
        <Link to="/for-landlords" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
          See how it works for landlords →
        </Link>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-16">
        <h2 className="text-center text-xl font-semibold text-slate-900">How It Works</h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {STEPS.map((step, i) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</div>
              <p className="text-center text-sm font-medium text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900">Apartments.com helps you find a property.</h3>
            <p className="mt-2 text-sm text-slate-600">
              The Perfect Tennant helps you become a <strong>verified renter</strong> — one Passport, reusable
              across every property you apply to.
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900">Apartments.com gives landlords applications.</h3>
            <p className="mt-2 text-sm text-slate-600">
              The Perfect Tennant gives landlords <strong>verified rental prospects</strong> — Rental Ready
              tenants who already match their property.
            </p>
          </Card>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-slate-900">The Perfect Tennant Passport™</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-medium text-slate-800">Sarah Miller</p>
              <p className="text-sm font-semibold text-emerald-700">🟢 RENTAL READY</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>✓ Identity Verified</li>
                <li>✓ Income Verified</li>
                <li>✓ Employment Verified</li>
                <li>✓ Rental History Verified</li>
                <li>✓ Credit Screening Completed</li>
                <li>✓ Background Screening Completed</li>
                <li>✓ Eviction Search Completed</li>
                <li>✓ References Verified</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-800">Rental Preferences</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>📍 West Omaha, Elkhorn, Gretna</li>
                <li>💰 $1,500–$2,000/month</li>
                <li>🛏 2+ Bedrooms</li>
                <li>📅 Available October 1</li>
                <li>🐕 1 Dog</li>
                <li>📄 12-Month Lease</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Match scoring is rule-based on objective listing facts only — never on protected characteristics.
          </p>
        </Card>
      </div>
    </div>
  );
}
