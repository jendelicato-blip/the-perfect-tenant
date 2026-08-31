import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { AdminMetrics } from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import type { PerfectPayMilestone, PlatformFeeConfig, SubscriptionPlan } from "@/types/domain";
import { PerfectPartnersAdminSection } from "@/pages/admin/PerfectPartnersAdmin";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [feeConfig, setFeeConfig] = useState<PlatformFeeConfig | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingMilestone, setSavingMilestone] = useState<string | null>(null);
  const [savingFee, setSavingFee] = useState(false);

  async function load() {
    const [m, p, ms, fee] = await Promise.all([
      api.getAdminMetrics(),
      api.listSubscriptionPlans(),
      api.listPerfectPayMilestones(),
      api.getPlatformFeeConfig(),
    ]);
    setMetrics(m);
    setPlans([...p].sort((a, b) => a.price_cents - b.price_cents));
    setMilestones([...ms].sort((a, b) => a.sort_order - b.sort_order));
    setFeeConfig(fee);
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

  async function saveMilestone(milestone: PerfectPayMilestone, required: number) {
    setSavingMilestone(milestone.level);
    try {
      await api.updatePerfectPayMilestone(milestone.level, required);
      await load();
    } finally {
      setSavingMilestone(null);
    }
  }

  async function saveFeeConfig(patch: Partial<Omit<PlatformFeeConfig, "updated_at">>) {
    setSavingFee(true);
    try {
      await api.updatePlatformFeeConfig(patch);
      await load();
    } finally {
      setSavingFee(false);
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
        <StatTile label="Active sponsored campaigns" value={metrics.activeCampaignsCount} />
        <StatTile label="Campaigns pending review" value={metrics.pendingReviewCampaignsCount} />
        <StatTile label="Perfect Partners" value={metrics.perfectPartnersCount} />
        <StatTile label="Partner offer redemptions" value={metrics.partnerOfferRedemptionsCount} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Perfect Rent™ analytics</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Active incentives" value={metrics.activeIncentivesCount} />
        <StatTile label="Properties offering incentives" value={metrics.propertiesWithIncentives} />
        <StatTile label="Average discount" value={`$${(metrics.avgDiscountCents / 100).toLocaleString()}/mo`} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Perfect Pay™ / Rewards analytics</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Tenants with verified payments" value={metrics.verifiedPaymentTenants} />
        <StatTile label="Total on-time payments" value={metrics.totalOnTimePayments} />
        <StatTile label="Reward events issued" value={metrics.rewardEventsCount} />
        <StatTile label="Autopay-enrolled tenants" value={metrics.autopayEnrolledTenants} />
        <StatTile label="Autopay rate" value={`${metrics.autopayRatePercent}%`} />
        <StatTile label="Landlords with payouts connected" value={metrics.connectedPayoutLandlords} />
      </div>

      {feeConfig && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-slate-900">Perfect Pay™ platform fees</h2>
          <p className="text-sm text-slate-600">Never hard-coded in the client — configured here and disclosed to landlords.</p>
          <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Percent fee
              <Input
                type="number"
                min={0}
                step={0.1}
                value={feeConfig.percent_fee}
                onChange={(e) => setFeeConfig({ ...feeConfig, percent_fee: Number(e.target.value) })}
                className="w-20"
              />
              %
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Flat fee ($)
              <Input
                type="number"
                min={0}
                step={0.01}
                value={feeConfig.flat_fee_cents / 100}
                onChange={(e) => setFeeConfig({ ...feeConfig, flat_fee_cents: Math.round(Number(e.target.value) * 100) })}
                className="w-24"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Paid by
              <Select
                value={feeConfig.fee_payer}
                onChange={(e) => setFeeConfig({ ...feeConfig, fee_payer: e.target.value as PlatformFeeConfig["fee_payer"] })}
                className="w-32"
              >
                <option value="landlord">Landlord</option>
                <option value="tenant">Tenant</option>
              </Select>
            </label>
            <Button
              variant="secondary"
              disabled={savingFee}
              onClick={() => saveFeeConfig({ percent_fee: feeConfig.percent_fee, flat_fee_cents: feeConfig.flat_fee_cents, fee_payer: feeConfig.fee_payer })}
            >
              {savingFee ? "Saving…" : "Save"}
            </Button>
          </Card>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Perfect Pay™ milestones</h2>
      <p className="text-sm text-slate-600">Consecutive on-time payments required for each level — never hard-coded in the client.</p>
      <div className="mt-4 space-y-2">
        {milestones.map((m) => (
          <MilestoneRow key={m.level} milestone={m} onSave={(n) => saveMilestone(m, n)} saving={savingMilestone === m.level} />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Subscription plans</h2>
      <p className="text-sm text-slate-600">Pricing is never hard-coded in the client — it's read from here.</p>
      <div className="mt-4 space-y-3">
        {plans.map((plan) => (
          <PlanRow key={plan.tier} plan={plan} onSave={(price) => savePlan(plan, price)} saving={saving === plan.tier} />
        ))}
      </div>

      <PerfectPartnersAdminSection />
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

function MilestoneRow({ milestone, onSave, saving }: { milestone: PerfectPayMilestone; onSave: (required: number) => void; saving: boolean }) {
  const [value, setValue] = useState(milestone.consecutive_payments_required.toString());
  return (
    <Card className="flex items-center justify-between p-4">
      <p className="font-medium capitalize text-slate-900">{milestone.level}</p>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="w-24" />
        <span className="text-sm text-slate-500">consecutive payments</span>
        <Button variant="secondary" disabled={saving} onClick={() => onSave(Number(value))}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
