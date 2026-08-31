import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  type Application,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type PropertyWithPhotos,
  type TenantSummary,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = { new: "⚪", bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface Row {
  application: Application;
  tenant: TenantSummary;
  property: PropertyWithPhotos;
  paymentThisMonth: PaymentVerification | null;
}

export function LandlordRentCollection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentVerification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [properties, payments, ms] = await Promise.all([
        api.listPropertiesForLandlord(user.id),
        api.listPaymentVerificationsForLandlord(user.id),
        api.listPerfectPayMilestones(),
      ]);
      setAllPayments(payments);
      setMilestones(ms);
      const month = currentMonth();
      const perProperty = await Promise.all(
        properties.map(async (property) => {
          const applicants = await api.listApplicantsForProperty(property.id);
          return applicants
            .filter((a) => a.application.status === "approved")
            .map(({ application, tenant }) => ({
              application,
              tenant,
              property,
              paymentThisMonth: payments.find((p) => p.property_id === property.id && p.tenant_id === tenant.tenant.user_id && p.period_start.startsWith(month)) ?? null,
            }));
        }),
      );
      setRows(perProperty.flat());
      setLoading(false);
    })();
  }, [user]);

  const scheduledRent = rows.reduce((sum, r) => sum + r.property.rent, 0);
  const collected = rows.filter((r) => r.paymentThisMonth?.status === "on_time").reduce((sum, r) => sum + r.property.rent, 0);
  const paidCount = rows.filter((r) => r.paymentThisMonth?.status === "on_time").length;
  const lateCount = rows.filter((r) => r.paymentThisMonth?.status === "late").length;
  const disputedCount = rows.filter((r) => r.paymentThisMonth?.status === "disputed").length;
  const pendingCount = rows.length - paidCount - lateCount - disputedCount;
  const pctCollected = scheduledRent > 0 ? Math.round((collected / scheduledRent) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Rent Collection</h1>
      <p className="mt-1 text-sm text-slate-500">
        Status reflects only payments you've confirmed for {new Date(`${currentMonth()}-01`).toLocaleDateString(undefined, { year: "numeric", month: "long" })} — confirm a payment from the applicant's page.
      </p>

      {!loading && (
        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink-900">${collected.toLocaleString()} / ${scheduledRent.toLocaleString()} collected</p>
            <p className="text-sm font-semibold text-brand-700">{pctCollected}%</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500" style={{ width: `${pctCollected}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            <span>🟢 Paid: {paidCount}</span>
            <span>🟡 Late: {lateCount}</span>
            <span>⚠️ Action Required: {pendingCount}</span>
            {disputedCount > 0 && <span>Disputed: {disputedCount}</span>}
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No approved tenants yet.</p>}
        {rows.map(({ application, tenant, property, paymentThisMonth }) => {
          const tenantPayments = allPayments.filter((p) => p.tenant_id === tenant.tenant.user_id);
          const { level } = milestones.length
            ? computePerfectPayLevel(computeOnTimeStreak(tenantPayments), milestones)
            : { level: "new" as PerfectPayLevel };
          const status = paymentThisMonth
            ? paymentThisMonth.status === "on_time"
              ? { emoji: "🟢", label: "Paid", tone: "success" as const }
              : paymentThisMonth.status === "late"
                ? { emoji: "🟡", label: "Paid late", tone: "warning" as const }
                : { emoji: "⚠️", label: "Disputed", tone: "default" as const }
            : { emoji: "⚠️", label: "Action Required", tone: "warning" as const };
          return (
            <Card key={application.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-slate-900">{tenant.user.email}</p>
                <p className="text-sm text-slate-500">{property.address}</p>
              </div>
              <div className="text-sm text-slate-600">${property.rent.toLocaleString()}/mo</div>
              <Badge tone={status.tone}>
                {status.emoji} {status.label}
              </Badge>
              <div className="text-xs text-slate-500">
                {paymentThisMonth ? new Date(paymentThisMonth.verified_at).toLocaleDateString() : "—"}
              </div>
              <div className="text-sm">
                {LEVEL_EMOJI[level]} {level[0].toUpperCase() + level.slice(1)}
              </div>
              <Link to={`/landlord/applicants/${property.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                Record payment →
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
