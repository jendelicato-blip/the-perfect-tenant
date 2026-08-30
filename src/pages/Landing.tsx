import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isSupabaseConfigured } from "@/lib/data/supabaseClient";

export function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {!isSupabaseConfigured && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Running in local dev mode — data is stored in your browser only (no Supabase project
          connected yet). Try the demo accounts on the login page.
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Find your perfect tenant. Find your perfect home.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            A rental marketplace that matches verified tenants to landlords with a clear,
            explainable score — not a black box.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/signup?role=tenant">
              <Button>I'm looking for a home</Button>
            </Link>
            <Link to="/signup?role=landlord">
              <Button variant="secondary">I'm a landlord</Button>
            </Link>
          </div>
        </div>
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900">Why it matches</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>✓ Rent within your budget</li>
            <li>✓ Beds/baths meet your minimum</li>
            <li>✓ Inside your preferred search radius</li>
            <li>✓ Available by your move-in date</li>
            <li>✓ Pet policy compatible with your household</li>
          </ul>
          <p className="mt-4 text-xs text-slate-400">
            Match scoring is rule-based on objective listing facts only — never on protected
            characteristics.
          </p>
        </Card>
      </div>
    </div>
  );
}
