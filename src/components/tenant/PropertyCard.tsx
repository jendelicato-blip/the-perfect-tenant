import { useEffect } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PerfectRentBadge } from "@/components/tenant/PerfectRentBadge";
import type { MatchReason, PropertyWithPhotos } from "@/types/domain";

// `sponsored`/`campaignId` are the only difference paid placement is ever
// allowed to make here: a label and (via the caller) a position in the
// list. `score` always comes from the same scoreMatch() computation a
// tenant's organic results use — a sponsored card never gets a different
// score, real or displayed.
export function PropertyCard({
  property,
  score,
  reasons,
  saved,
  onToggleSave,
  sponsored,
  campaignId,
}: {
  property: PropertyWithPhotos;
  score?: number;
  reasons?: MatchReason[];
  saved?: boolean;
  onToggleSave?: () => void;
  sponsored?: boolean;
  campaignId?: string;
}) {
  const photo = property.photos[0]?.url;

  useEffect(() => {
    if (sponsored && campaignId) void api.recordAdImpression("campaign", campaignId, "property_card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  function handleViewDetails() {
    if (sponsored && campaignId) void api.recordAdClick("campaign", campaignId, "property_card");
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className="h-32 w-40 flex-none bg-slate-100">
          {photo && <img src={photo} alt={property.address} className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link to={`/properties/${property.id}`} className="font-semibold text-slate-900 hover:underline">
                {property.address}
              </Link>
              <p className="text-sm text-slate-500">
                {property.city}, {property.state} · {property.beds === 0 ? "Studio" : `${property.beds} bd`} / {property.baths} ba
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">${property.rent.toLocaleString()}/mo</p>
              <div className="mt-1 flex flex-wrap justify-end gap-1">
                {sponsored && <Badge tone="brand">⭐ Sponsored</Badge>}
                {score !== undefined && <Badge tone={score >= 70 ? "success" : score >= 40 ? "warning" : "default"}>{score}% match</Badge>}
              </div>
            </div>
          </div>

          {reasons && (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {reasons.filter((r) => r.matched).slice(0, 3).map((r) => (
                <li key={r.label}>✓ {r.label}</li>
              ))}
            </ul>
          )}

          <div className="mt-2">
            <PerfectRentBadge propertyId={property.id} rentCents={property.rent * 100} state={property.state} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Link to={`/properties/${property.id}`} onClick={handleViewDetails} className="text-xs font-medium text-brand-600 hover:underline">
              View details
            </Link>
            {onToggleSave && (
              <button onClick={onToggleSave} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                {saved ? "★ Saved" : "☆ Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
