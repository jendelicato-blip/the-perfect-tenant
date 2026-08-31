import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import type { LandlordPublicProfile } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PerfectRentBadge } from "@/components/tenant/PerfectRentBadge";
import { PerfectRentCalculator } from "@/components/tenant/PerfectRentCalculator";
import { isVerifiedLandlord, type LandlordReview, type PropertyWithPhotos } from "@/types/domain";

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [applied, setApplied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [interested, setInterested] = useState(false);
  const [landlord, setLandlord] = useState<LandlordPublicProfile | null>(null);
  const [reviews, setReviews] = useState<LandlordReview[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getProperty(id).then((p) => {
      setProperty(p);
      if (p) {
        api.getLandlordPublicProfile(p.landlord_id).then(setLandlord);
        api.listLandlordReviews(p.landlord_id).then(setReviews);
      }
    });
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

  async function handleInterested() {
    if (!user || !property) return;
    const nowInterested = await api.toggleTenantInterest(user.id, property.id);
    setInterested(nowInterested);
  }

  const averageRating = reviews.length ? reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length : null;

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
          {landlord && (
            <div className="mt-1 flex items-center gap-2 text-sm">
              {isVerifiedLandlord(landlord) && <Badge tone="success">✓ Verified Landlord</Badge>}
              {averageRating !== null && <span className="text-slate-500">⭐ {averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})</span>}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">Starting at ${property.rent.toLocaleString()}/mo</p>
          <PerfectRentBadge propertyId={property.id} rentCents={property.rent * 100} state={property.state} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{property.beds === 0 ? "Studio" : `${property.beds} bd`}</Badge>
        <Badge>{property.baths} ba</Badge>
        <Badge>{property.sqft ? `${property.sqft} sqft` : "—"}</Badge>
        <Badge tone="brand">Available {property.available_date}</Badge>
        <Badge>{property.lease_term_months}-month lease</Badge>
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

      <PerfectRentCalculator
        propertyId={property.id}
        rentCents={property.rent * 100}
        state={property.state}
        propertyLeaseTermMonths={property.lease_term_months}
      />

      {user?.role === "tenant" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleApply} disabled={applied}>
            {applied ? `Application ${status}` : "Apply With My Passport"}
          </Button>
          <Button variant="secondary" onClick={handleMessage}>
            Message landlord
          </Button>
          <Button variant="secondary" onClick={handleInterested}>
            {interested ? "✓ You're interested" : "I'm Interested"}
          </Button>
        </div>
      )}
    </div>
  );
}
