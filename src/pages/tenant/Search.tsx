import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import type { PropertyFilter } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PropertyCard } from "@/components/tenant/PropertyCard";
import { PartnerOffersSidebar } from "@/components/tenant/PartnerOffersSidebar";
import { Button } from "@/components/ui/Button";
import { FormRow, Input } from "@/components/ui/Field";
import type { PropertyWithPhotos } from "@/types/domain";

export function TenantSearch() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PropertyFilter>({});
  const [perfectRentOnly, setPerfectRentOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(currentFilter: PropertyFilter, perfectRentFilter: boolean) {
    setLoading(true);
    const [results, saved] = await Promise.all([
      api.listProperties(currentFilter),
      user ? api.listSavedProperties(user.id) : Promise.resolve([]),
    ]);
    let filtered = results;
    if (perfectRentFilter) {
      const withIncentives = await Promise.all(
        results.map(async (p) => ((await api.listRentIncentives(p.id)).some((i) => i.enabled) ? p : null)),
      );
      filtered = withIncentives.filter((p): p is PropertyWithPhotos => p !== null);
    }
    setProperties(filtered);
    setSavedIds(new Set(saved.map((p) => p.id)));
    setLoading(false);
  }

  useEffect(() => {
    load({}, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex gap-8">
      <div className="min-w-0 flex-1">
      <h1 className="text-2xl font-bold text-slate-900">Search listings</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(filter, perfectRentOnly);
        }}
        className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <FormRow label="City">
          <Input value={filter.city ?? ""} onChange={(e) => setFilter({ ...filter, city: e.target.value })} />
        </FormRow>
        <FormRow label="Min rent">
          <Input type="number" value={filter.minRent ?? ""} onChange={(e) => setFilter({ ...filter, minRent: e.target.value ? Number(e.target.value) : undefined })} />
        </FormRow>
        <FormRow label="Max rent">
          <Input type="number" value={filter.maxRent ?? ""} onChange={(e) => setFilter({ ...filter, maxRent: e.target.value ? Number(e.target.value) : undefined })} />
        </FormRow>
        <FormRow label="Min beds">
          <Input type="number" value={filter.beds ?? ""} onChange={(e) => setFilter({ ...filter, beds: e.target.value ? Number(e.target.value) : undefined })} />
        </FormRow>
        <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700 sm:col-span-4">
          <input type="checkbox" checked={perfectRentOnly} onChange={(e) => setPerfectRentOnly(e.target.checked)} />
          Show only properties with Perfect Rent™ available
        </label>
        <div className="col-span-2 sm:col-span-4">
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && properties.length === 0 && <p className="text-sm text-slate-500">No listings match those filters.</p>}
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} saved={savedIds.has(p.id)} onToggleSave={user ? () => toggleSave(p.id) : undefined} />
        ))}
      </div>
      </div>

      <PartnerOffersSidebar placement="search_sidebar" />
      </div>
    </div>
  );
}
