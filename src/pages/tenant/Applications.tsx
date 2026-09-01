import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { LandlordReviewForm } from "@/components/tenant/LandlordReviewForm";
import type { Application, LandlordReview, PropertyWithPhotos } from "@/types/domain";

const STATUS_TONE: Record<Application["status"], "default" | "brand" | "success" | "warning"> = {
  submitted: "brand",
  reviewing: "warning",
  approved: "success",
  declined: "default",
  withdrawn: "default",
};

export function TenantApplications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<{ application: Application; property: PropertyWithPhotos | null }[]>([]);
  const [reviewedPropertyIds, setReviewedPropertyIds] = useState<Set<string>>(new Set());
  const [reviewFormOpenFor, setReviewFormOpenFor] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const apps = await api.listApplicationsForTenant(user.id);
    const withProperties = await Promise.all(
      apps.map(async (application) => ({ application, property: await api.getProperty(application.property_id) })),
    );
    setRows(withProperties);

    const landlordIds = [...new Set(withProperties.map((r) => r.property?.landlord_id).filter((x): x is string => Boolean(x)))];
    const reviewLists = await Promise.all(landlordIds.map((id) => api.listLandlordReviews(id)));
    const mine = reviewLists.flat().filter((r: LandlordReview) => r.tenant_id === user.id);
    setReviewedPropertyIds(new Set(mine.map((r) => r.property_id).filter((x): x is string => Boolean(x))));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Your applications</h1>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">You haven't applied to any listings yet.</p>}
        {rows.map(({ application, property }) => {
          const canReview = application.status === "approved" && property && !reviewedPropertyIds.has(property.id);
          return (
            <Card key={application.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link to={`/properties/${application.property_id}`} className="font-medium text-slate-900 hover:underline">
                    {property?.address ?? "Listing"}
                  </Link>
                  <p className="text-xs text-slate-500">Applied {new Date(application.created_at).toLocaleDateString()}</p>
                </div>
                <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
              </div>
              {canReview && (
                <>
                  {reviewFormOpenFor === application.id ? (
                    user && property && (
                      <LandlordReviewForm
                        landlordId={property.landlord_id}
                        tenantId={user.id}
                        propertyId={property.id}
                        onSubmitted={() => {
                          setReviewFormOpenFor(null);
                          load();
                        }}
                      />
                    )
                  ) : (
                    <button
                      className="mt-2 text-sm font-medium text-brand-600 hover:underline"
                      onClick={() => setReviewFormOpenFor(application.id)}
                    >
                      Rate your landlord
                    </button>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
