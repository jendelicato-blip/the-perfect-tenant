import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { CampaignMetrics } from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { AdCampaign, AdPackage } from "@/types/domain";

// Landlord self-service Sponsored Property purchase. No card is ever
// charged here (Phase 1 stub, same pattern as subscription billing) —
// submitting moves the campaign to "pending_review"; only an admin
// approval (which records a real ad_revenue_events row from the package's
// real price) makes it live. Money buys VISIBILITY only — this panel has
// no way to touch the property's Perfect Match™ score, because nothing
// here writes to that computation at all.
export function PromotePropertyPanel({ landlordId, propertyId }: { landlordId: string; propertyId: string }) {
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [pkgs, campaigns] = await Promise.all([api.listAdPackages("sponsored_property"), api.listCampaignsForLandlord(landlordId)]);
    setPackages(pkgs);
    setSelectedPackage((prev) => prev || pkgs[0]?.id || "");
    const latest = campaigns
      .filter((c) => c.property_id === propertyId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    setCampaign(latest ?? null);
    if (latest && latest.status === "approved") {
      setMetrics(await api.getCampaignMetrics(latest.id));
    } else {
      setMetrics(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function submit() {
    if (!selectedPackage) return;
    setSubmitting(true);
    try {
      await api.createSponsoredPropertyCampaign(landlordId, propertyId, selectedPackage);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  const packageById = new Map(packages.map((p) => [p.id, p]));
  const isActive = campaign?.status === "approved" && (!campaign.ends_at || new Date(campaign.ends_at) >= new Date());

  return (
    <div>
      <p className="text-sm text-slate-600">
        Pay to increase this listing's visibility with a "⭐ Sponsored" label in search and matches.
        This never changes your Perfect Match™ score — only where the listing appears.
      </p>

      {!campaign && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackage(pkg.id)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  selectedPackage === pkg.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-semibold text-ink-900">{pkg.name}</p>
                <p className="text-xs text-slate-500">{pkg.duration_days} days</p>
                <p className="mt-1 font-semibold text-brand-700">${(pkg.price_cents / 100).toFixed(2)}</p>
              </button>
            ))}
          </div>
          <Button onClick={submit} disabled={submitting || !selectedPackage}>
            {submitting ? "Submitting…" : "Submit for review"}
          </Button>
          <p className="text-xs text-slate-400">
            Submitting sends this to an admin for review before it goes live — no charge happens automatically yet
            (billing isn't wired up in this preview).
          </p>
        </div>
      )}

      {campaign && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">{packageById.get(campaign.package_id ?? "")?.name ?? "Sponsored Property"}</p>
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.status === "pending_review" && (
            <p className="mt-1 text-xs text-slate-500">Waiting on admin review — you'll see it go live here once approved.</p>
          )}
          {campaign.status === "rejected" && (
            <p className="mt-1 text-xs text-red-600">{campaign.rejection_reason ?? "This campaign was rejected."}</p>
          )}
          {isActive && campaign.ends_at && (
            <p className="mt-1 text-xs text-slate-500">Active through {new Date(campaign.ends_at).toLocaleDateString()}.</p>
          )}
          {isActive && metrics && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your Property Promotion</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Impressions" value={metrics.impressions} />
                <Metric label="Leads" value={metrics.leads} />
                <Metric label="Applications" value={metrics.applications} />
                <Metric label="Spend" value={`$${((packageById.get(campaign.package_id ?? "")?.price_cents ?? 0) / 100).toFixed(2)}`} />
              </div>
            </div>
          )}
          {(campaign.status === "rejected" || campaign.status === "expired") && (
            <div className="mt-3">
              <select
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — ${(pkg.price_cents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
              <Button variant="secondary" className="ml-2" disabled={submitting} onClick={submit}>
                Submit new campaign
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-bold text-ink-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AdCampaign["status"] }) {
  const tone = status === "approved" ? "success" : status === "rejected" ? "warning" : "default";
  const label: Record<AdCampaign["status"], string> = {
    draft: "Draft",
    pending_review: "Pending review",
    approved: "⭐ Sponsored",
    rejected: "Rejected",
    paused: "Paused",
    expired: "Expired",
  };
  return <Badge tone={tone as "default" | "success" | "warning"}>{label[status]}</Badge>;
}
