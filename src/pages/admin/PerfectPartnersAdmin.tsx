import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { AdvertisingRevenue } from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import {
  AD_CATEGORY_LABELS,
  type AdCampaign,
  type AdCategory,
  type AdFrequencyRules,
  type AdPackage,
  type PartnerOffer,
  type PerfectPartner,
} from "@/types/domain";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

// Everything here is admin-only in practice via RLS on the live project —
// see 0006_perfect_partners.sql's admin_all/admin_write policies. Approving
// a paid campaign is the one action that writes a real ad_revenue_events
// row (never a fabricated number) from the package's real configured price.
export function PerfectPartnersAdminSection() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [partners, setPartners] = useState<PerfectPartner[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [rules, setRules] = useState<AdFrequencyRules | null>(null);
  const [revenue, setRevenue] = useState<AdvertisingRevenue | null>(null);
  const [newPartner, setNewPartner] = useState({ name: "", category: "moving" as AdCategory, emoji: "🤝", tagline: "" });
  const [newOffer, setNewOffer] = useState<Record<string, { title: string; description: string; offer_text: string; promo_code: string; cta_label: string }>>({});

  async function load() {
    const [c, p, pp, o, r, rev] = await Promise.all([
      api.listCampaignsForReview(),
      api.listAdPackages(undefined, false),
      api.listPerfectPartners(false),
      api.listPartnerOffers(undefined, false),
      api.getAdFrequencyRules(),
      api.getAdvertisingRevenue(),
    ]);
    setCampaigns(c);
    setPackages(p);
    setPartners(pp);
    setOffers(o);
    setRules(r);
    setRevenue(rev);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    await api.reviewCampaign(id, "approved");
    await load();
  }
  async function reject(id: string) {
    const reason = window.prompt("Reason for rejecting this campaign?") ?? undefined;
    await api.reviewCampaign(id, "rejected", reason);
    await load();
  }
  async function toggleStatus(campaign: AdCampaign) {
    await api.setCampaignStatus(campaign.id, campaign.status === "paused" ? "approved" : "paused");
    await load();
  }
  async function savePackage(pkg: AdPackage, patch: Partial<Pick<AdPackage, "price_cents" | "active">>) {
    await api.updateAdPackage(pkg.id, patch);
    await load();
  }
  async function saveRules(patch: Partial<AdFrequencyRules>) {
    await api.updateAdFrequencyRules(patch);
    await load();
  }
  async function addPartner() {
    if (!newPartner.name.trim()) return;
    await api.createPerfectPartner({ advertiser_id: null, category: newPartner.category, name: newPartner.name, emoji: newPartner.emoji, tagline: newPartner.tagline || null, active: true, sort_order: partners.length });
    setNewPartner({ name: "", category: "moving", emoji: "🤝", tagline: "" });
    await load();
  }
  async function togglePartnerActive(partner: PerfectPartner) {
    await api.updatePerfectPartner(partner.id, { active: !partner.active });
    await load();
  }
  async function addOffer(partnerId: string) {
    const form = newOffer[partnerId];
    if (!form?.title.trim()) return;
    await api.createPartnerOffer({
      partner_id: partnerId,
      title: form.title,
      description: form.description,
      offer_text: form.offer_text,
      promo_code: form.promo_code || null,
      cta_label: form.cta_label || "Get Offer",
      destination_url: null,
      expires_at: null,
      active: true,
    });
    setNewOffer((prev) => ({ ...prev, [partnerId]: { title: "", description: "", offer_text: "", promo_code: "", cta_label: "" } }));
    await load();
  }
  async function toggleOfferActive(offer: PartnerOffer) {
    await api.updatePartnerOffer(offer.id, { active: !offer.active });
    await load();
  }

  const pending = campaigns.filter((c) => c.status === "pending_review");
  const others = campaigns.filter((c) => c.status !== "pending_review");

  return (
    <div>
      <h2 className="mt-10 text-xl font-bold text-slate-900">Perfect Partners™ / Advertising</h2>

      <h3 className="mt-6 text-lg font-semibold text-slate-900">Advertising Revenue</h3>
      {revenue && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatTile label="Today" value={`$${(revenue.todayCents / 100).toLocaleString()}`} />
          <StatTile label="This Week" value={`$${(revenue.weekCents / 100).toLocaleString()}`} />
          <StatTile label="This Month" value={`$${(revenue.monthCents / 100).toLocaleString()}`} />
          <StatTile label="This Year" value={`$${(revenue.yearCents / 100).toLocaleString()}`} />
          <StatTile label="Total" value={`$${(revenue.totalCents / 100).toLocaleString()}`} />
        </div>
      )}

      <h3 className="mt-8 text-lg font-semibold text-slate-900">Campaign Review Queue</h3>
      <p className="text-sm text-slate-600">Nothing goes live to a tenant until approved here.</p>
      <div className="mt-4 space-y-2">
        {pending.length === 0 && <p className="text-sm text-slate-500">No campaigns waiting on review.</p>}
        {pending.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{c.headline}</p>
                <p className="text-xs text-slate-500">
                  {c.campaign_type} · {c.target_city ?? "—"}, {c.target_state ?? "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => approve(c.id)}>Approve</Button>
                <Button variant="secondary" onClick={() => reject(c.id)}>Reject</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Other campaigns</p>
          {others.map((c) => (
            <Card key={c.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{c.headline}</p>
                <p className="text-xs text-slate-500">{c.campaign_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={c.status === "approved" ? "success" : c.status === "rejected" ? "warning" : "default"}>{c.status}</Badge>
                {(c.status === "approved" || c.status === "paused") && (
                  <Button variant="secondary" onClick={() => toggleStatus(c)}>
                    {c.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h3 className="mt-8 text-lg font-semibold text-slate-900">Sponsored Property packages</h3>
      <p className="text-sm text-slate-600">Pricing is never hard-coded — landlords choose from these when promoting a listing.</p>
      <div className="mt-4 space-y-2">
        {packages.map((pkg) => (
          <Card key={pkg.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-slate-900">{pkg.name}</p>
              <p className="text-xs text-slate-500">{pkg.duration_days} days</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">$</span>
              <Input
                type="number"
                min={0}
                defaultValue={(pkg.price_cents / 100).toString()}
                onBlur={(e) => savePackage(pkg, { price_cents: Math.round(Number(e.target.value) * 100) })}
                className="w-24"
              />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={pkg.active} onChange={(e) => savePackage(pkg, { active: e.target.checked })} />
                Active
              </label>
            </div>
          </Card>
        ))}
      </div>

      <h3 className="mt-8 text-lg font-semibold text-slate-900">Ad frequency rules</h3>
      <p className="text-sm text-slate-600">"Useful, relevant, never overwhelming" as an actual ceiling — not just a design intention.</p>
      {rules && (
        <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Max sponsored properties per page
            <Input type="number" min={0} defaultValue={rules.max_sponsored_properties_per_page} onBlur={(e) => saveRules({ max_sponsored_properties_per_page: Number(e.target.value) })} className="w-16" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Max partner cards per page
            <Input type="number" min={0} defaultValue={rules.max_partner_cards_per_page} onBlur={(e) => saveRules({ max_partner_cards_per_page: Number(e.target.value) })} className="w-16" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={rules.ads_enabled} onChange={(e) => saveRules({ ads_enabled: e.target.checked })} />
            Ads enabled
          </label>
        </Card>
      )}

      <h3 className="mt-8 text-lg font-semibold text-slate-900">Perfect Partners™ directory</h3>
      <p className="text-sm text-slate-600">Only add a partner when a real partnership exists — never a fake business or offer.</p>
      <div className="mt-4 space-y-4">
        {partners.map((partner) => (
          <Card key={partner.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">
                {partner.emoji} {partner.name} <span className="text-xs text-slate-400">({AD_CATEGORY_LABELS[partner.category]})</span>
              </p>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={partner.active} onChange={() => togglePartnerActive(partner)} />
                Active
              </label>
            </div>
            <div className="mt-2 space-y-1">
              {offers.filter((o) => o.partner_id === partner.id).map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs">
                  <span>{offer.title} — {offer.offer_text}</span>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={offer.active} onChange={() => toggleOfferActive(offer)} />
                    Active
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Input placeholder="Offer title" value={newOffer[partner.id]?.title ?? ""} onChange={(e) => setNewOffer((p) => ({ ...p, [partner.id]: { title: e.target.value, description: p[partner.id]?.description ?? "", offer_text: p[partner.id]?.offer_text ?? "", promo_code: p[partner.id]?.promo_code ?? "", cta_label: p[partner.id]?.cta_label ?? "" } }))} />
              <Input placeholder="Description" value={newOffer[partner.id]?.description ?? ""} onChange={(e) => setNewOffer((p) => ({ ...p, [partner.id]: { ...p[partner.id], title: p[partner.id]?.title ?? "", offer_text: p[partner.id]?.offer_text ?? "", promo_code: p[partner.id]?.promo_code ?? "", cta_label: p[partner.id]?.cta_label ?? "", description: e.target.value } }))} />
              <Input placeholder="Offer text ($50 off...)" value={newOffer[partner.id]?.offer_text ?? ""} onChange={(e) => setNewOffer((p) => ({ ...p, [partner.id]: { ...p[partner.id], title: p[partner.id]?.title ?? "", description: p[partner.id]?.description ?? "", promo_code: p[partner.id]?.promo_code ?? "", cta_label: p[partner.id]?.cta_label ?? "", offer_text: e.target.value } }))} />
              <Input placeholder="Promo code (optional)" value={newOffer[partner.id]?.promo_code ?? ""} onChange={(e) => setNewOffer((p) => ({ ...p, [partner.id]: { ...p[partner.id], title: p[partner.id]?.title ?? "", description: p[partner.id]?.description ?? "", offer_text: p[partner.id]?.offer_text ?? "", cta_label: p[partner.id]?.cta_label ?? "", promo_code: e.target.value } }))} />
              <Button variant="secondary" onClick={() => addOffer(partner.id)}>Add offer</Button>
            </div>
          </Card>
        ))}

        <Card className="p-4">
          <p className="text-sm font-medium text-slate-800">Add a Perfect Partner</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Input placeholder="Emoji" value={newPartner.emoji} onChange={(e) => setNewPartner({ ...newPartner, emoji: e.target.value })} className="w-16" />
            <Input placeholder="Business name" value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} />
            <Select value={newPartner.category} onChange={(e) => setNewPartner({ ...newPartner, category: e.target.value as AdCategory })}>
              {(Object.keys(AD_CATEGORY_LABELS) as AdCategory[]).map((cat) => (
                <option key={cat} value={cat}>{AD_CATEGORY_LABELS[cat]}</option>
              ))}
            </Select>
            <Input placeholder="Tagline" value={newPartner.tagline} onChange={(e) => setNewPartner({ ...newPartner, tagline: e.target.value })} />
            <Button variant="secondary" onClick={addPartner}>Add partner</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
