import { useState } from "react";
import * as api from "@/lib/data/api";
import { Button } from "@/components/ui/Button";

const CATEGORIES = [
  ["communication_rating", "Communication"],
  ["maintenance_rating", "Maintenance responsiveness"],
  ["accuracy_rating", "Accuracy of listing"],
  ["professionalism_rating", "Professionalism"],
  ["move_in_rating", "Move-in experience"],
] as const;

export function LandlordReviewForm({
  landlordId,
  tenantId,
  propertyId,
  onSubmitted,
}: {
  landlordId: string;
  tenantId: string;
  propertyId: string;
  onSubmitted: () => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({
    communication_rating: 5,
    maintenance_rating: 5,
    accuracy_rating: 5,
    professionalism_rating: 5,
    move_in_rating: 5,
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createLandlordReview({
        landlord_id: landlordId,
        tenant_id: tenantId,
        property_id: propertyId,
        communication_rating: ratings.communication_rating,
        maintenance_rating: ratings.maintenance_rating,
        accuracy_rating: ratings.accuracy_rating,
        professionalism_rating: ratings.professionalism_rating,
        move_in_rating: ratings.move_in_rating,
        comment: comment || null,
      });
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Rate your landlord</p>
      {CATEGORIES.map(([key, label]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{label}</span>
          <select
            value={ratings[key]}
            onChange={(e) => setRatings((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} ⭐
              </option>
            ))}
          </select>
        </div>
      ))}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional comment"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
