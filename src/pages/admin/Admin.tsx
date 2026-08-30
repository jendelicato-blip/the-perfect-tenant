import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { SubscriptionPlan } from "@/types/domain";

interface Metrics {
  totalTenants: number;
  rentalReadyTenants: number;
  totalLandlords: number;
  verifiedLandlords: number;
  totalProperties: number;
  totalApplications: number;
  passportShares: number;
  mrrCents: number;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const [m, p] = await Promise.all([api.getAdminMetrics(), api.listSubscriptionPlans()]);
    setMetrics(m);
    setPlans([...p].sort((a, b) => a.price_cents - b.price_cents));
  }

  useEffect(() => {
    load();
  }, []);

  async function savePlan(plan: SubscriptionPlan, priceDollars: number) {
    setSaving(plan.tier);
    try {
      await api.updateSubscriptionPlan(plan.tier, { price_cents: Math.round(priceDollars * 100) });
      await load();
    } finally {
      setSaving(null);
    }
  }

  if (!metrics) return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total tenants" value={metrics.totalTenants} />
        <StatTile label="Rental Ready tenants" value={metrics.rentalReadyTenants} />
        <StatTile label="Total landlords" value={metrics.totalLandlords} />
        <StatTile label="Verified landlords" value={metrics.verifiedLandlords} />
        <StatTile label="Properties" value={metrics.totalProperties} />
        <StatTile label="Applications" value={metrics.totalApplications} />
        <StatTile label="Passport shares" value={metrics.passportShares} />
        <StatTile label="MRR" value={`$${(metrics.mrrCents / 100).toLocaleString()}`} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Subscription plans</h2>
      <p className="text-sm text-slate-600">Pricing is never hard-coded in the client — it's read from here.</p>
      <div className="mt-4 space-y-3">
        {plans.map((plan) => (
          <PlanRow key={plan.tier} plan={plan} onSave={(price) => savePlan(plan, price)} saving={saving === plan.tier} />
        ))}
      </div>
    </div>
  );
}

function PlanRow({ plan, onSave, saving }: { plan: SubscriptionPlan; onSave: (priceDollars: number) => void; saving: boolean }) {
  const [price, setPrice] = useState((plan.price_cents / 100).toString());
  return (
    <Card className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium text-slate-900">{plan.name}</p>
        <p className="text-xs text-slate-500">{plan.features.join(" · ")}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">$</span>
        <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-24" />
        <span className="text-sm text-slate-500">/{plan.billing_period}</span>
        <Button variant="secondary" disabled={saving} onClick={() => onSave(Number(price))}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
