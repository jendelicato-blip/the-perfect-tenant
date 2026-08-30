import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Application, PropertyWithPhotos } from "@/types/domain";

export function LandlordDashboard() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listPropertiesForLandlord(user.id).then(setProperties);
    api.listApplicationsForLandlord(user.id).then(setApplications);
  }, [user]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    await api.deleteProperty(id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your listings</h1>
        <Link to="/landlord/properties/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {properties.length === 0 && <p className="text-sm text-slate-500">No listings yet — create your first one.</p>}
        {properties.map((p) => {
          const count = applications.filter((a) => a.property_id === p.id).length;
          return (
            <Card key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-16 w-24 flex-none overflow-hidden rounded-lg bg-slate-100">
                {p.photos[0] && <img src={p.photos[0].url} alt={p.address} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{p.address}</p>
                <p className="text-sm text-slate-500">
                  {p.city}, {p.state} · ${p.rent}/mo · {p.beds} bd / {p.baths} ba
                </p>
              </div>
              <Badge tone={p.status === "active" ? "success" : "default"}>{p.status}</Badge>
              <Link to={`/landlord/applicants/${p.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                {count} applicant{count === 1 ? "" : "s"}
              </Link>
              <Link to={`/landlord/properties/${p.id}/edit`} className="text-sm font-medium text-slate-600 hover:underline">
                Edit
              </Link>
              <Button variant="danger" onClick={() => handleDelete(p.id)}>
                Delete
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
