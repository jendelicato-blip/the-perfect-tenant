import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { RentalReadyBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type PropertyWithPhotos, type TenantInterest, type TenantSummary } from "@/types/domain";

export function LandlordInterests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<{ interest: TenantInterest; tenant: TenantSummary }[]>([]);
  const [properties, setProperties] = useState<Record<string, PropertyWithPhotos>>({});

  useEffect(() => {
    if (!user) return;
    api.listInterestsForLandlord(user.id).then(async (results) => {
      setRows(results);
      const props = await Promise.all(
        [...new Set(results.map((r) => r.interest.property_id))].map((id) => api.getProperty(id)),
      );
      setProperties(Object.fromEntries(props.filter((p): p is PropertyWithPhotos => p !== null).map((p) => [p.id, p])));
    });
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Tenant Interest</h1>
      <p className="mt-1 text-sm text-slate-600">Verified tenants who told you they're interested in a listing.</p>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && <p className="text-sm text-slate-500">No tenant interest yet.</p>}
        {rows.map(({ interest, tenant }) => {
          const rentalReady = computeRentalReady(tenant.verification);
          const property = properties[interest.property_id];
          return (
            <Card key={`${interest.tenant_id}-${interest.property_id}`} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link to={`/landlord/tenants/${tenant.tenant.user_id}`} className="font-medium text-slate-900 hover:underline">
                    {tenant.user.email.split("@")[0]}
                  </Link>
                  <p className="text-sm text-slate-500">Interested in {property?.address ?? "a property"}</p>
                </div>
                <RentalReadyBadge level={rentalReady.level} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
