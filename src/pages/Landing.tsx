import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isSupabaseConfigured } from "@/lib/data/supabaseClient";
import * as api from "@/lib/data/api";
import { PerfectRentBadge } from "@/components/tenant/PerfectRentBadge";
import { InlineLogo } from "@/components/Logo";
import type { PropertyWithPhotos } from "@/types/domain";

const TRUST_ITEMS = [
  { icon: "🛡️", title: "Verified Tenants", body: "Stand out with a verified Perfect10ant Passport™." },
  { icon: "🎯", title: "Perfect Match™", body: "Get matched to homes that fit your budget and needs." },
  { icon: "🤝", title: "Two-Sided Trust", body: "Landlords are verified too — know who you're renting from." },
  { icon: "🏢", title: "Trusted by Landlords", body: "Connect with landlords who value verified tenants." },
];

const STEPS = [
  { icon: "👤", title: "Create Your Profile", body: "Build your Perfect10ant Passport™ in minutes." },
  { icon: "🛡️", title: "Get Verified", body: "Complete verification once so landlords can trust you." },
  { icon: "🏠", title: "Find Your Home", body: "Browse listings with your Perfect Match™ score." },
  { icon: "✅", title: "Rent With Confidence", body: "Apply with your Passport — no starting over." },
];

export function Landing() {
  const [featured, setFeatured] = useState<PropertyWithPhotos | null>(null);

  useEffect(() => {
    api.listProperties().then((props) => setFeatured(props[0] ?? null));
  }, []);

  return (
    <div>
      {!isSupabaseConfigured && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Running in local dev mode — data is stored in your browser only (no Supabase project
            connected yet). Try the demo accounts on the login page.
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              Be the tenant every landlord wants
            </span>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.08] text-ink-900">
              Better Tenants.
              <br />
              Better Matches.
              <br />
              <span className="text-brand-600">Rent With Confidence.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-slate-600">
              <InlineLogo className="h-8 w-auto" /> helps you build one verified Passport, get
              matched to homes that fit, and rent with confidence — get verified once, use it
              everywhere.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup?role=tenant">
                <Button className="px-6 py-3 text-base">Get Started Free</Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" className="px-6 py-3 text-base">
                  ▶ See How It Works
                </Button>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&q=80"
                alt="Tenant relaxing at home"
                className="h-96 w-full object-cover"
              />
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-xl bg-ink-900/90 px-4 py-3 text-white shadow-lg backdrop-blur">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-lg">✓</span>
              <div>
                <p className="text-sm font-semibold">Rental Ready</p>
                <p className="text-xs text-slate-200">You're verified and ready to apply.</p>
              </div>
            </div>
            <Card className="relative mt-6 w-full p-4 shadow-xl lg:absolute lg:-bottom-10 lg:right-0 lg:mt-0 lg:w-64">
              <p className="font-serif text-sm font-semibold text-ink-900">Your Perfect Rent™</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Example calculation — see your real numbers on any listing</p>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Base Rent</span>
                  <span>$2,000/mo</span>
                </div>
                <div className="flex justify-between text-brand-600">
                  <span>Perfect10ant Savings</span>
                  <span>-$100/mo</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-ink-900">
                  <span>Your Price</span>
                  <span>$1,900/mo</span>
                </div>
              </div>
              <Link to="/search" className="mt-3 block rounded-lg bg-brand-50 px-3 py-2 text-center text-sm font-semibold text-brand-700 hover:bg-brand-100">
                See real Perfect Rent™ options →
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-ink-900 py-8">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 sm:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-300">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works + sidebar */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2" id="how-it-works">
            <h2 className="font-serif text-2xl font-semibold text-ink-900">How It Works</h2>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl">
                    {step.icon}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{step.body}</p>
                </div>
              ))}
            </div>
            <Link to="/for-landlords" className="mt-8 inline-block text-sm font-medium text-brand-700 hover:underline">
              See how it works for landlords →
            </Link>

            <Card className="mt-10 p-6">
              <h3 className="font-serif text-lg font-semibold text-ink-900">The Perfect10ant Passport™</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-800">Sarah Miller</p>
                  <p className="text-sm font-semibold text-brand-700">🟢 RENTAL READY</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>✓ Identity Verified</li>
                    <li>✓ Income Verified</li>
                    <li>✓ Employment Verified</li>
                    <li>✓ Rental History Verified</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-800">Rental Preferences</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    <li>📍 West Omaha, Elkhorn, Gretna</li>
                    <li>💰 $1,500–$2,000/month</li>
                    <li>🛏 2+ Bedrooms</li>
                    <li>📅 Available October 1</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Perfect Match™ scoring is rule-based on objective listing facts only — never on
                protected characteristics.
              </p>
            </Card>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-ink-900 p-5 text-white">
              <span className="inline-block rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                Pay on time. Get rewarded.
              </span>
              <p className="mt-2 font-serif text-lg font-semibold">Perfect Pay™</p>
              <p className="mt-1 text-sm text-slate-300">
                Build your verified on-time payment history and track your progress toward
                Bronze, Silver, Gold, and Platinum.
              </p>
              <Link to="/perfect-pay" className="mt-3 inline-block text-sm font-medium text-brand-300 hover:underline">
                Learn more →
              </Link>
            </div>

            {featured && (
              <Card className="overflow-hidden">
                <img src={featured.photos[0]?.url} alt={featured.address} className="h-36 w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-ink-900">{featured.address}</p>
                      <p className="text-sm text-slate-500">{featured.city}, {featured.state}</p>
                    </div>
                    <span className="text-slate-300">♡</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-brand-700">${featured.rent.toLocaleString()}/mo</p>
                  <div className="mt-1">
                    <PerfectRentBadge propertyId={featured.id} rentCents={featured.rent * 100} state={featured.state} />
                  </div>
                  <Link to={`/properties/${featured.id}`} className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
                    View listing →
                  </Link>
                </div>
              </Card>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Sponsored
              </span>
              <p className="mt-2 font-serif text-base font-semibold text-ink-900">Perfect Partners™</p>
              <p className="mt-1 text-sm text-slate-600">
                Helpful, clearly-labeled offers for moving, insurance, and more — useful, relevant,
                never overwhelming.
              </p>
              <Link to="/partners" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
                See Perfect Partners™ →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
