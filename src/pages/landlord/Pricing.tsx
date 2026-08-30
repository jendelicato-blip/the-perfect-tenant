import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Subscription, SubscriptionTier } from "@/types/domain";

const TIERS: { tier: SubscriptionTier; name: string; price: string; features: string[] }[] = [
  {
    tier: "starter",
    name: "Starter",
    price: "$29/mo",
    features: ["1 active listing", "Basic match scoring", "Messaging"],
  },
  {
    tier: "growth",
    name: "Growth",
    price: "$79/mo",
    features: ["10 active listings", "Priority match ranking", "Saved tenants", "Email support"],
  },
  {
    tier: "portfolio",
    name: "Portfolio",
    price: "$199/mo",
    features: ["Unlimited listings", "Team seats", "Applicant analytics", "Priority support"],
  },
];

export function LandlordPricing() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [updating, setUpdating] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getSubscription(user.id).then(setSubscription);
  }, [user]);

  async function selectTier(tier: SubscriptionTier) {
    if (!user) return;
    setUpdating(tier);
    try {
      // Stripe checkout would be initiated here in production — this Phase 1
      // stub updates the subscription tier directly without payment collection.
      await api.setSubscriptionTier(user.id, tier);
      setSubscription((prev) => (prev ? { ...prev, tier } : prev));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
      <p className="mt-1 text-sm text-slate-600">
        Stripe checkout isn't wired up yet — selecting a tier here updates your plan directly for
        Phase 1 testing.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {TIERS.map((t) => {
          const current = subscription?.tier === t.tier;
          return (
            <Card key={t.tier} className={`p-6 ${current ? "ring-2 ring-brand-500" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">{t.name}</h2>
                {current && <Badge tone="brand">Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{t.price}</p>
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                {t.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={current ? "secondary" : "primary"}
                disabled={current || updating === t.tier}
                onClick={() => selectTier(t.tier)}
              >
                {current ? "Selected" : updating === t.tier ? "Updating…" : "Choose plan"}
              </Button>
            </Card>
          );
        })}
      </div>

      {subscription && (
        <p className="mt-6 text-xs text-slate-400">
          Status: {subscription.status}
          {subscription.renews_at && ` · renews ${new Date(subscription.renews_at).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}
