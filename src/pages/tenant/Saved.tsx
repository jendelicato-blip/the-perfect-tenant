import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PropertyCard } from "@/components/tenant/PropertyCard";
import { BackButton } from "@/components/ui/BackButton";
import type { PropertyWithPhotos } from "@/types/domain";

export function TenantSaved() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listSavedProperties(user.id).then(setProperties);
  }, [user]);

  async function toggleSave(propertyId: string) {
    if (!user) return;
    await api.toggleSavedProperty(user.id, propertyId);
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Saved properties</h1>
      <div className="mt-6 space-y-4">
        {properties.length === 0 && <p className="text-sm text-slate-500">You haven't saved any properties yet.</p>}
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} saved onToggleSave={() => toggleSave(p.id)} />
        ))}
      </div>
    </div>
  );
}
