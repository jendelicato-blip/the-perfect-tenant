import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PropertyWithPhotos } from "@/types/domain";

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [applied, setApplied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getProperty(id).then(setProperty);
    if (user?.role === "tenant") {
      api.listApplicationsForTenant(user.id).then((apps) => {
        const existing = apps.find((a) => a.property_id === id);
        if (existing) {
          setApplied(true);
          setStatus(existing.status);
        }
      });
    }
  }, [id, user]);

  if (!property) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  async function handleApply() {
    if (!user || !property) return;
    await api.createApplication(user.id, property.id);
    setApplied(true);
    setStatus("submitted");
  }

  async function handleMessage() {
    if (!user || !property) return;
    const conversation = await api.getOrCreateConversation(user.id, property.landlord_id, property.id);
    navigate(`/messages/${conversation.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {property.photos[0] && (
        <img src={property.photos[0].url} alt={property.address} className="h-64 w-full rounded-xl object-cover" />
      )}

      <div className="mt-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{property.address}</h1>
          <p className="text-slate-500">
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
        <p className="text-2xl font-bold text-slate-900">${property.rent.toLocaleString()}/mo</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{property.beds === 0 ? "Studio" : `${property.beds} bd`}</Badge>
        <Badge>{property.baths} ba</Badge>
        <Badge>{property.sqft ? `${property.sqft} sqft` : "—"}</Badge>
        <Badge tone="brand">Available {property.available_date}</Badge>
        <Badge>{property.pet_policy.replaceAll("_", " ")}</Badge>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-900">Description</h2>
        <p className="mt-2 text-sm text-slate-600">{property.description}</p>
        {property.amenities.length > 0 && (
          <>
            <h2 className="mt-4 font-semibold text-slate-900">Amenities</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {property.amenities.map((a) => (
                <li key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {a}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {user?.role === "tenant" && (
        <div className="mt-6 flex gap-3">
          <Button onClick={handleApply} disabled={applied}>
            {applied ? `Application ${status}` : "Apply now"}
          </Button>
          <Button variant="secondary" onClick={handleMessage}>
            Message landlord
          </Button>
        </div>
      )}
    </div>
  );
}
