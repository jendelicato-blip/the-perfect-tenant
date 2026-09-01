import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge, RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type Application, type ApplicationStatus, type PaymentStatus, type PropertyWithPhotos, type TenantSummary } from "@/types/domain";

const STATUS_TONE: Record<ApplicationStatus, "default" | "brand" | "success" | "warning"> = {
  submitted: "brand",
  reviewing: "warning",
  approved: "success",
  declined: "default",
  withdrawn: "default",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function LandlordApplicants() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { user } = useAuth();
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [rows, setRows] = useState<{ application: Application; tenant: TenantSummary }[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [paymentMonth, setPaymentMonth] = useState<Record<string, string>>({});
  const [paymentStatus, setPaymentStatus] = useState<Record<string, PaymentStatus>>({});
  const [recording, setRecording] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!propertyId) return;
    api.getProperty(propertyId).then(setProperty);
    api.listApplicantsForProperty(propertyId).then(setRows);
    if (user) {
      api.listSavedTenants(user.id).then((tenants) => setSavedIds(new Set(tenants.map((t) => t.tenant.user_id))));
      api.listPaymentVerificationsForLandlord(user.id).then((payments) => {
        const byTenant: Record<string, string[]> = {};
        for (const p of payments.filter((x) => x.property_id === propertyId)) {
          (byTenant[p.tenant_id] ??= []).push(p.period_start.slice(0, 7));
        }
        setRecorded(byTenant);
      });
    }
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

  async function recordPayment(tenantId: string) {
    if (!user || !propertyId) return;
    const month = paymentMonth[tenantId] ?? currentMonth();
    const status = paymentStatus[tenantId] ?? "on_time";
    setRecording(tenantId);
    try {
      await api.recordPayment(user.id, tenantId, propertyId, `${month}-01`, status);
      setRecorded((prev) => ({ ...prev, [tenantId]: [...(prev[tenantId] ?? []), month] }));
    } finally {
      setRecording(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Applicants{property ? ` — ${property.address}` : ""}</h1>

      <div className="mt-6 space-y-4">
        {rows.length === 0 && <p className="text-sm text-slate-500">No applicants yet.</p>}
        {rows.map(({ application, tenant }) => {
          const rentalReady = computeRentalReady(tenant.verification);
          const tenantId = tenant.tenant.user_id;
          return (
          <Card key={application.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{tenant.user.email}</p>
                <p className="mt-1 text-sm text-slate-600">{tenant.tenant.intro_text || "No intro provided."}</p>
                <p className="mt-1 text-xs text-slate-400">Household size: {tenant.tenant.household_size}</p>
                <div className="mt-2"><RentalReadyBadge level={rentalReady.level} /></div>
              </div>
              <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={tenant.verification.identity} />
              <VerificationBadge status={tenant.verification.income} />
              <VerificationBadge status={tenant.verification.employment} />
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

            {application.status === "approved" && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perfect Pay™ — record rent payment</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="month"
                    value={paymentMonth[tenantId] ?? currentMonth()}
                    onChange={(e) => setPaymentMonth((prev) => ({ ...prev, [tenantId]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <select
                    value={paymentStatus[tenantId] ?? "on_time"}
                    onChange={(e) => setPaymentStatus((prev) => ({ ...prev, [tenantId]: e.target.value as PaymentStatus }))}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="on_time">On time</option>
                    <option value="late">Late</option>
                    <option value="disputed">Disputed</option>
                  </select>
                  <Button variant="secondary" disabled={recording === tenantId} onClick={() => recordPayment(tenantId)}>
                    {recording === tenantId ? "Recording…" : "Record payment"}
                  </Button>
                </div>
                {recorded[tenantId]?.length ? (
                  <p className="mt-2 text-xs text-slate-500">Recorded: {recorded[tenantId].join(", ")}</p>
                ) : null}
              </div>
            )}
          </Card>
          );
        })}
      </div>
    </div>
  );
}
