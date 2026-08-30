import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { MatchReason, PropertyWithPhotos } from "@/types/domain";

export function PropertyCard({
  property,
  score,
  reasons,
  saved,
  onToggleSave,
}: {
  property: PropertyWithPhotos;
  score?: number;
  reasons?: MatchReason[];
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const photo = property.photos[0]?.url;
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
              {score !== undefined && <Badge tone={score >= 70 ? "success" : score >= 40 ? "warning" : "default"}>{score}% match</Badge>}
            </div>
          </div>

          {reasons && (
            <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
              {reasons.filter((r) => r.matched).slice(0, 3).map((r) => (
                <li key={r.label}>✓ {r.label}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Link to={`/properties/${property.id}`} className="text-xs font-medium text-brand-600 hover:underline">
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
