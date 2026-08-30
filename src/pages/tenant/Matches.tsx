import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { ScoredProperty } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PropertyCard } from "@/components/tenant/PropertyCard";

export function TenantMatches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<ScoredProperty[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.getMatchesForTenant(user.id), api.listSavedProperties(user.id)]).then(([m, saved]) => {
      setMatches(m);
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
          />
        ))}
      </div>
    </div>
  );
}
