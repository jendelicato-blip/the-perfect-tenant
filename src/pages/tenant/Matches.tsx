import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { ScoredProperty } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PropertyCard } from "@/components/tenant/PropertyCard";
import { BackButton } from "@/components/ui/BackButton";
import { interleaveSponsoredProperties, type WithSponsorFlag } from "@/lib/perfectPartners/engine";

export function TenantMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<WithSponsorFlag<ScoredProperty>[]>([]);
  const [campaignByProperty, setCampaignByProperty] = useState<Map<string, string>>(new Map());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getMatchesForTenant(user.id),
      api.listSavedProperties(user.id),
      api.listActiveSponsoredPropertyCampaigns(),
      api.getAdFrequencyRules(),
    ]).then(([m, saved, campaigns, rules]) => {
      const idToCampaign = new Map(campaigns.filter((c) => c.property_id).map((c) => [c.property_id as string, c.id]));
      setCampaignByProperty(idToCampaign);
      setMatches(interleaveSponsoredProperties(m, new Set(idToCampaign.keys()), rules));
      setSavedIds(new Set(saved.map((p) => p.id)));
      setLoading(false);
    });
  }, [user]);

  async function toggleSave(propertyId: string) {
    if (!user) return;
    const nowSaved = await api.toggleSavedProperty(user.id, propertyId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(propertyId);
      else next.delete(propertyId);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Your matches</h1>
      <p className="mt-1 text-sm text-slate-600">
        Ranked by fit against your saved preferences. Update them anytime from your profile.
      </p>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && matches.length === 0 && <p className="text-sm text-slate-500">No listings yet — check back soon.</p>}
        {matches.map((m) => (
          <PropertyCard
            key={m.property.id}
            property={m.property}
            score={m.score}
            reasons={m.reasons}
            saved={savedIds.has(m.property.id)}
            onToggleSave={() => toggleSave(m.property.id)}
            sponsored={m.sponsored}
            campaignId={campaignByProperty.get(m.property.id)}
          />
        ))}
      </div>
    </div>
  );
}
