import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Application, PropertyWithPhotos } from "@/types/domain";

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

  useEffect(() => {
    if (!user) return;
    api.listApplicationsForTenant(user.id).then(async (apps) => {
      const withProperties = await Promise.all(
        apps.map(async (application) => ({ application, property: await api.getProperty(application.property_id) })),
      );
      setRows(withProperties);
    });
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Your applications</h1>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">You haven't applied to any listings yet.</p>}
        {rows.map(({ application, property }) => (
          <Card key={application.id} className="flex items-center justify-between p-4">
            <div>
              <Link to={`/properties/${application.property_id}`} className="font-medium text-slate-900 hover:underline">
                {property?.address ?? "Listing"}
              </Link>
              <p className="text-xs text-slate-500">Applied {new Date(application.created_at).toLocaleDateString()}</p>
            </div>
            <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
