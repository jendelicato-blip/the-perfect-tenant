import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { computePerfectRent } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type Application, type TenantSummary, type VerifiedPurchase, type VerifiedTierConfig } from "@/types/domain";

const BENEFITS = [
  "A stronger, independently-verified Passport",
  "Faster applications — reusable verified information",
  "Eligibility for participating Perfect Rent™ incentives that require Verified status",
  "Verified rental history landlords can trust",
  "Perfect Pay™ integration carries forward with your Passport",
];

// Used only when the tenant has no active lease to compute a real quote
// from (see the "real quote" branch below) — an illustrative example,
// exactly like the one on the marketing homepage, never presented as an
// actual number the tenant will receive.
const EXAMPLE_MONTHLY_SAVINGS_CENTS = 2500;

export function TenantVerified() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [config, setConfig] = useState<VerifiedTierConfig | null>(null);
  const [purchase, setPurchase] = useState<VerifiedPurchase | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [realAnnualSavingsCents, setRealAnnualSavingsCents] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const checkoutResult = searchParams.get("checkout");

  async function load() {
    if (!user) return;
    const [s, c, p, apps] = await Promise.all([
      api.getTenantSummary(user.id),
      api.getVerifiedTierConfig(),
      api.getOwnVerifiedPurchase(user.id),
      api.listApplicationsForTenant(user.id),
    ]);
    setSummary(s);
    setConfig(c);
    setPurchase(p);
    setApplications(apps);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (checkoutResult) {
      if (checkoutResult === "success") load();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutResult]);

  useEffect(() => {
    if (!user || !summary) return;
    const approved = applications.find((a) => a.status === "approved");
    if (!approved) {
      setRealAnnualSavingsCents(null);
      return;
    }
    (async () => {
      const property = await api.getProperty(approved.property_id);
      if (!property) return;
      const [incentives, rules] = await Promise.all([api.listRentIncentives(property.id), api.listJurisdictionRules()]);
      const rentalReady = computeRentalReady(summary.verification);
      const quote = computePerfectRent({
        baseRentCents: property.rent * 100,
        incentives: incentives.filter((i) => i.enabled),
        jurisdictionAllowed: buildJurisdictionAllowed(rules, property.state),
        qualifies: {
          passport_verified: rentalReady.level === "rental_ready",
          rental_history: summary.verification.rentalHistory === "verified",
          auto_payment: false,
        },
        chosenLeaseMonths: property.lease_term_months,
      });
      setRealAnnualSavingsCents(quote.potentialAnnualSavingsCents);
    })();
  }, [user, summary, applications]);

  async function handlePurchase() {
    if (!user || !config) return;
    setPurchasing(true);
    try {
      const checkoutUrl = await api.startVerifiedCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      // No live Stripe checkout configured (local dev-mode, or Stripe
      // secrets not set yet) — same Phase 1 fallback Pricing.tsx uses.
      await api.purchaseVerifiedDirect(user.id, config.price_cents);
      await load();
    } finally {
      setPurchasing(false);
    }
  }

  if (!summary || !config) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const priceDollars = (config.price_cents / 100).toFixed(2);
  const usingRealQuote = realAnnualSavingsCents !== null;
  const annualSavingsCents = realAnnualSavingsCents ?? EXAMPLE_MONTHLY_SAVINGS_CENTS * 12;
  const netBenefitCents = annualSavingsCents - config.price_cents;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-700">
        🏅 Perfect10ant Verified™
      </span>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Prove You're Rental Ready.</h1>
      <p className="mt-2 text-sm text-slate-600">
        Independent verification of your identity, income, and rental history — on top of the free verification steps
        already in your Passport. This is an upgrade to a stronger Passport, not a requirement: your free Passport
        remains genuinely useful on its own.
      </p>

      {checkoutResult === "cancelled" && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Checkout was cancelled — no changes were made.
        </p>
      )}

      {purchase ? (
        <Card className="mt-6 border-gold-300 bg-gold-50 p-6">
          <p className="text-lg font-bold text-gold-700">🏅 You're Perfect10ant Verified</p>
          <p className="mt-1 text-sm text-gold-900">
            Purchased {new Date(purchase.purchased_at).toLocaleDateString()} · ${(purchase.amount_paid_cents / 100).toFixed(2)}
          </p>
          <Link to="/passport" className="mt-3 inline-block text-sm font-semibold text-gold-700 hover:underline">
            View my Passport →
          </Link>
        </Card>
      ) : (
        <>
          <Card className="mt-6 p-6">
            <h2 className="font-semibold text-slate-900">What you get</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="text-brand-600">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="mt-4 p-6">
            <h2 className="font-semibold text-slate-900">Your Perfect10ant Verified™ value</h2>
            <p className="mt-1 text-xs text-slate-400">
              {usingRealQuote
                ? "Based on the Perfect Rent™ incentives your current property actually offers."
                : "Example calculation — see your real numbers once you've applied to a property offering Perfect Rent™."}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Verification cost</span>
                <span className="font-medium text-slate-900">${priceDollars}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Potential Perfect Rent™ savings</span>
                <span className="font-medium text-brand-700">${(annualSavingsCents / 100).toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <span className="text-slate-900">Potential net benefit (year 1)</span>
                <span className={netBenefitCents >= 0 ? "text-brand-700" : "text-slate-900"}>
                  {netBenefitCents >= 0 ? "+" : ""}
                  ${(netBenefitCents / 100).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Potential savings only — never guaranteed. You only receive a Perfect Rent™ discount from a property that
              actually offers one and that you actually qualify for.
            </p>
          </Card>

          <Button className="mt-4 w-full" onClick={handlePurchase} disabled={purchasing}>
            {purchasing ? "Starting checkout…" : `Get Verified — $${priceDollars}`}
          </Button>
        </>
      )}
    </div>
  );
}
