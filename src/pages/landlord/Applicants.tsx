import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Application, ApplicationStatus, PropertyWithPhotos, TenantSummary } from "@/types/domain";

const STATUS_TONE: Record<ApplicationStatus, "default" | "brand" | "success" | "warning"> = {
  submitted: "brand",
  reviewing: "warning",
  approved: "success",
  declined: "default",
  withdrawn: "default",
};

export function LandlordApplicants() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { user } = useAuth();
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [rows, setRows] = useState<{ application: Application; tenant: TenantSummary }[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!propertyId) return;
    api.getProperty(propertyId).then(setProperty);
    api.listApplicantsForProperty(propertyId).then(setRows);
    if (user) api.listSavedTenants(user.id).then((tenants) => setSavedIds(new Set(tenants.map((t) => t.tenant.user_id))));
  }, [propertyId, user]);

  async function updateStatus(applicationId: string, status: ApplicationStatus) {
    await api.updateApplicationStatus(applicationId, status);
    setRows((prev) => prev.map((r) => (r.application.id === applicationId ? { ...r, application: { ...r.application, status } } : r)));
  }

  async function toggleSaveTenant(tenantId: string) {
    if (!user) return;
    const nowSaved = await api.toggleSavedTenant(user.id, tenantId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(tenantId);
      else next.delete(tenantId);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Applicants{property ? ` — ${property.address}` : ""}</h1>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && <p className="text-sm text-slate-500">No applicants yet.</p>}
        {rows.map(({ application, tenant }) => (
          <Card key={application.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{tenant.user.email}</p>
                <p className="mt-1 text-sm text-slate-600">{tenant.tenant.intro_text || "No intro provided."}</p>
                <p className="mt-1 text-xs text-slate-400">Household size: {tenant.tenant.household_size}</p>
              </div>
              <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={tenant.verification.identity} />
              <VerificationBadge status={tenant.verification.income} />
              <VerificationBadge status={tenant.verification.credit} />
              <VerificationBadge status={tenant.verification.background} />
              <VerificationBadge status={tenant.verification.eviction} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => updateStatus(application.id, "reviewing")}>
                Mark reviewing
              </Button>
              <Button onClick={() => updateStatus(application.id, "approved")}>Approve</Button>
              <Button variant="danger" onClick={() => updateStatus(application.id, "declined")}>
                Decline
              </Button>
              <button
                onClick={() => toggleSaveTenant(tenant.tenant.user_id)}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                {savedIds.has(tenant.tenant.user_id) ? "★ Saved" : "☆ Save tenant"}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
