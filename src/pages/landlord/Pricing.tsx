import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Subscription, SubscriptionPlan, SubscriptionTier } from "@/types/domain";

export function LandlordPricing() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [updating, setUpdating] = useState<SubscriptionTier | null>(null);
  const checkoutResult = searchParams.get("checkout");
  const isLandlord = user?.role === "landlord";

  useEffect(() => {
    if (!isLandlord || !user) return;
    api.getSubscription(user.id).then(setSubscription);
  }, [user, isLandlord]);

  useEffect(() => {
    api.listSubscriptionPlans().then((loaded) => setPlans([...loaded].sort((a, b) => a.price_cents - b.price_cents)));
  }, []);

  useEffect(() => {
    if (checkoutResult) {
      setSearchParams({}, { replace: true });
    }
  }, [checkoutResult, setSearchParams]);

  async function selectTier(tier: SubscriptionTier) {
    if (!user) return;
    setUpdating(tier);
    try {
      const checkoutUrl = await api.startCheckout(user.id, tier);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      // No live Stripe checkout configured (local dev-mode, or Stripe
      // secrets not set yet) — fall back to updating the tier directly.
      await api.setSubscriptionTier(user.id, tier);
      setSubscription((prev) => (prev ? { ...prev, tier } : prev));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
        Landlord subscription
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-ink-900">Simple, transparent pricing</h1>
      <p className="mx-auto mt-2 max-w-xl text-slate-600">
        Choosing a plan redirects to Stripe Checkout once it's configured (see
        docs/ARCHITECTURE.md); until then it updates your plan directly for Phase 1 testing.
      </p>
      {checkoutResult === "success" && (
        <p className="mx-auto mt-3 max-w-xl rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Checkout complete — your plan will update once Stripe's webhook confirms the payment.
        </p>
      )}
      {checkoutResult === "cancelled" && (
        <p className="mx-auto mt-3 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Checkout was cancelled — no changes were made.
        </p>
      )}

      <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
        {plans.map((t) => {
          const current = isLandlord && subscription?.tier === t.tier;
          return (
            <Card key={t.tier} className={`p-6 ${current ? "ring-2 ring-brand-500" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold text-ink-900">{t.name}</h2>
                {current && <Badge tone="brand">Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold text-ink-900">
                ${(t.price_cents / 100).toLocaleString()}/{t.billing_period}
              </p>
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                {t.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {isLandlord ? (
                <Button
                  className="mt-6 w-full"
                  variant={current ? "secondary" : "primary"}
                  disabled={current || updating === t.tier}
                  onClick={() => selectTier(t.tier)}
                >
                  {current ? "Selected" : updating === t.tier ? "Updating…" : "Choose plan"}
                </Button>
              ) : (
                <Link to="/signup?role=landlord">
                  <Button className="mt-6 w-full">Get Started Free</Button>
                </Link>
              )}
            </Card>
          );
        })}
      </div>

      {isLandlord && subscription && (
        <p className="mt-6 text-xs text-slate-400">
          Status: {subscription.status}
          {subscription.renews_at && ` · renews ${new Date(subscription.renews_at).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}
