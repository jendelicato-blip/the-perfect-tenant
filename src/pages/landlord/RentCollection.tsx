import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  DISPUTE_CATEGORY_LABELS,
  type Application,
  type Dispute,
  type PaymentRefund,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type PropertyWithPhotos,
  type RefundType,
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

function RefundForm({ onSubmit, onCancel }: { onSubmit: (amountCents: number, type: RefundType, reason: string) => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<RefundType>("full");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const amountCents = Math.round(Number(amount) * 100);
    if (!amountCents || amountCents <= 0 || !reason.trim()) return;
    setSaving(true);
    try {
      await onSubmit(amountCents, type, reason.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-600">
          $
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <select value={type} onChange={(e) => setType(e.target.value as RefundType)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
          <option value="full">Full refund</option>
          <option value="partial">Partial refund</option>
        </select>
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for this refund…"
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={saving || !amount || !reason.trim()} onClick={handleSubmit}>
          {saving ? "Issuing…" : "Issue refund"}
        </Button>
      </div>
    </div>
  );
}

export function LandlordRentCollection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentVerification[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);
  const [refundFormOpenFor, setRefundFormOpenFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDisputesAndRefunds() {
    if (!user) return;
    const [d, r] = await Promise.all([api.listDisputesForLandlord(user.id), api.listRefundsForLandlord(user.id)]);
    setDisputes(d);
    setRefunds(r);
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [props, payments, ms] = await Promise.all([
        api.listPropertiesForLandlord(user.id),
        api.listPaymentVerificationsForLandlord(user.id),
        api.listPerfectPayMilestones(),
      ]);
      setProperties(props);
      setAllPayments(payments);
      setMilestones(ms);
      const month = currentMonth();
      const perProperty = await Promise.all(
        props.map(async (property) => {
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
    loadDisputesAndRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleResolve(disputeId: string, resolution: "resolved" | "dismissed") {
    if (!user) return;
    await api.resolveDispute(disputeId, user.id, resolution);
    await loadDisputesAndRefunds();
  }

  async function handleIssueRefund(paymentId: string, amountCents: number, type: RefundType, reason: string) {
    if (!user) return;
    await api.issueRefund(paymentId, user.id, amountCents, type, reason);
    setRefundFormOpenFor(null);
    await loadDisputesAndRefunds();
  }

  const scheduledRent = rows.reduce((sum, r) => sum + r.property.rent, 0);
  const collected = rows.filter((r) => r.paymentThisMonth?.status === "on_time").reduce((sum, r) => sum + r.property.rent, 0);
  const paidCount = rows.filter((r) => r.paymentThisMonth?.status === "on_time").length;
  const lateCount = rows.filter((r) => r.paymentThisMonth?.status === "late").length;
  const disputedCount = rows.filter((r) => r.paymentThisMonth?.status === "disputed").length;
  const pendingCount = rows.length - paidCount - lateCount - disputedCount;
  const pctCollected = scheduledRent > 0 ? Math.round((collected / scheduledRent) * 100) : 0;
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "reviewing");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
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

      {openDisputes.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-slate-900">Open Disputes</h2>
          <div className="mt-3 space-y-3">
            {openDisputes.map((dispute) => {
              const payment = dispute.payment_verification_id ? allPayments.find((p) => p.id === dispute.payment_verification_id) : undefined;
              const property = payment ? properties.find((p) => p.id === payment.property_id) : undefined;
              const tenantEmail = payment ? rows.find((r) => r.tenant.tenant.user_id === payment.tenant_id)?.tenant.user.email : undefined;
              return (
                <Card key={dispute.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{tenantEmail ?? "Tenant"}{property ? ` — ${property.address}` : ""}</p>
                      {payment && (
                        <p className="text-xs text-slate-400">
                          {new Date(payment.period_start).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
                        {dispute.category ? DISPUTE_CATEGORY_LABELS[dispute.category] : "Dispute"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{dispute.reason}</p>
                    </div>
                    <Badge tone="warning">{dispute.status === "open" ? "Open" : "Reviewing"}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => handleResolve(dispute.id, "resolved")}>
                      Mark resolved
                    </Button>
                    <Button variant="danger" onClick={() => handleResolve(dispute.id, "dismissed")}>
                      Dismiss
                    </Button>
                    {payment && (
                      <button
                        className="text-sm font-medium text-brand-600 hover:underline"
                        onClick={() => setRefundFormOpenFor(refundFormOpenFor === `dispute:${payment.id}` ? null : `dispute:${payment.id}`)}
                      >
                        Issue refund
                      </button>
                    )}
                  </div>
                  {payment && refundFormOpenFor === `dispute:${payment.id}` && (
                    <RefundForm
                      onSubmit={(amountCents, type, reason) => handleIssueRefund(payment.id, amountCents, type, reason)}
                      onCancel={() => setRefundFormOpenFor(null)}
                    />
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Tenants</h2>
      <div className="mt-3 space-y-3">
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
          const refund = paymentThisMonth ? refunds.find((r) => r.payment_verification_id === paymentThisMonth.id) : undefined;
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
              {paymentThisMonth && !refund && (
                <button
                  className="text-sm font-medium text-slate-500 hover:text-brand-700 hover:underline"
                  onClick={() =>
                    setRefundFormOpenFor(refundFormOpenFor === `row:${paymentThisMonth.id}` ? null : `row:${paymentThisMonth.id}`)
                  }
                >
                  Issue refund
                </button>
              )}
              {refund && (
                <span className="text-xs text-brand-700">
                  ↩ {refund.type === "full" ? "Full" : "Partial"} refund issued: ${(refund.amount_cents / 100).toLocaleString()}
                </span>
              )}
              {paymentThisMonth && refundFormOpenFor === `row:${paymentThisMonth.id}` && (
                <RefundForm
                  onSubmit={(amountCents, type, reason) => handleIssueRefund(paymentThisMonth.id, amountCents, type, reason)}
                  onCancel={() => setRefundFormOpenFor(null)}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
