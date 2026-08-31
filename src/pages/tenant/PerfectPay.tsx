import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { computePerfectRent, type AppliedIncentive } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  computeNextAutopayDate,
  computeOnTimeStreak,
  computePerfectPayLevel,
  computeRentalReady,
  DISPUTE_CATEGORY_LABELS,
  type Dispute,
  type DisputeCategory,
  type PaymentRefund,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type PropertyWithPhotos,
  type RewardEvent,
  type Tenant,
  type TenantSummary,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = {
  new: "⚪",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

const PAYMENT_STATUS_META: Record<PaymentVerification["status"], { emoji: string; label: string }> = {
  on_time: { emoji: "🟢", label: "Paid on time" },
  late: { emoji: "🟡", label: "Paid late" },
  disputed: { emoji: "⚠️", label: "Disputed" },
};

const DISPUTE_STATUS_META: Record<Dispute["status"], { label: string; tone: "default" | "brand" | "success" | "warning" }> = {
  open: { label: "Dispute open", tone: "warning" },
  reviewing: { label: "Dispute in review", tone: "warning" },
  resolved: { label: "Dispute resolved", tone: "success" },
  dismissed: { label: "Dispute dismissed", tone: "default" },
};

function levelLabel(level: PerfectPayLevel): string {
  return level[0].toUpperCase() + level.slice(1);
}

function PaymentDisputeRow({
  payment,
  rentDollars,
  dispute,
  refund,
  onFileDispute,
}: {
  payment: PaymentVerification;
  rentDollars: number | null;
  dispute: Dispute | undefined;
  refund: PaymentRefund | undefined;
  onFileDispute: (category: DisputeCategory, reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory>("incorrect_amount");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onFileDispute(category, reason.trim());
      setOpen(false);
      setReason("");
    } finally {
      setSaving(false);
    }
  }

  const meta = PAYMENT_STATUS_META[payment.status];

  return (
    <div className="border-b border-slate-100 py-1.5 last:border-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{new Date(payment.period_start).toLocaleDateString(undefined, { year: "numeric", month: "long" })}</span>
        <div className="flex items-center gap-2">
          {rentDollars !== null && <span className="text-slate-500">${rentDollars.toLocaleString()}</span>}
          <Badge tone={payment.status === "on_time" ? "success" : payment.status === "late" ? "warning" : "default"}>
            {meta.emoji} {meta.label}
          </Badge>
          {dispute ? (
            <Badge tone={DISPUTE_STATUS_META[dispute.status].tone}>{DISPUTE_STATUS_META[dispute.status].label}</Badge>
          ) : (
            <button className="text-xs font-medium text-slate-400 hover:text-red-600 hover:underline" onClick={() => setOpen((v) => !v)}>
              Dispute
            </button>
          )}
        </div>
      </div>
      {refund && (
        <p className="mt-1 text-xs text-brand-700">
          ↩ {refund.type === "full" ? "Full" : "Partial"} refund of ${(refund.amount_cents / 100).toLocaleString()} — {refund.reason}
        </p>
      )}
      {open && !dispute && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DisputeCategory)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {(Object.keys(DISPUTE_CATEGORY_LABELS) as DisputeCategory[]).map((c) => (
              <option key={c} value={c}>
                {DISPUTE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell your landlord what's wrong with this record…"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !reason.trim()} onClick={handleSubmit}>
              {saving ? "Submitting…" : "Submit dispute"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TenantPerfectPay() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [applied, setApplied] = useState<AppliedIncentive[]>([]);
  const [effectiveRentCents, setEffectiveRentCents] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [events, setEvents] = useState<RewardEvent[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);

  function loadDisputesAndRefunds(tenantId: string) {
    api.listDisputesForTenant(tenantId).then(setDisputes);
    api.listRefundsForTenant(tenantId).then(setRefunds);
  }

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
    api.listPaymentVerificationsForTenant(user.id).then(setPayments);
    api.listPerfectPayMilestones().then(setMilestones);
    api.listRewardEvents(user.id).then(setEvents);
    api.getCurrentRentalForTenant(user.id).then((rental) => setProperty(rental?.property ?? null));
    loadDisputesAndRefunds(user.id);
  }, [user]);

  async function handleFileDispute(paymentId: string, category: DisputeCategory, reason: string) {
    if (!user) return;
    await api.fileDispute(paymentId, user.id, category, reason);
    loadDisputesAndRefunds(user.id);
  }

  useEffect(() => {
    if (!user) return;
    api.getOwnPaymentSetup(user.id).then((setup) =>
      setTenant((prev) => ({ ...(prev ?? ({} as Tenant)), ...setup })),
    );
  }, [user]);

  useEffect(() => {
    if (!user || !summary || !property) return;
    (async () => {
      const [incentives, rules, setup] = await Promise.all([
        api.listRentIncentives(property.id),
        api.listJurisdictionRules(),
        api.getOwnPaymentSetup(user.id),
      ]);
      const rentalReady = computeRentalReady(summary.verification);
      const quote = computePerfectRent({
        baseRentCents: property.rent * 100,
        incentives: incentives.filter((i) => i.enabled),
        jurisdictionAllowed: buildJurisdictionAllowed(rules, property.state),
        qualifies: {
          passport_verified: rentalReady.level === "rental_ready",
          rental_history: summary.verification.rentalHistory === "verified",
          auto_payment: setup.auto_payment_enrolled,
        },
        chosenLeaseMonths: property.lease_term_months,
      });
      setApplied(quote.applied.filter((a) => a.status === "applied"));
      setEffectiveRentCents(quote.estimatedRentCents);
    })();
  }, [user, summary, property]);

  if (!milestones.length || !summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const streak = computeOnTimeStreak(payments);
  const { level, next } = computePerfectPayLevel(streak, milestones);
  const progressTarget = next?.consecutive_payments_required ?? milestones[milestones.length - 1].consecutive_payments_required;
  const progressPct = progressTarget > 0 ? Math.min(100, Math.round((streak / progressTarget) * 100)) : 100;

  const autopayOn = tenant?.auto_payment_enrolled ?? false;
  const nextDueDate = tenant?.autopay_day ? computeNextAutopayDate(tenant.autopay_day) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect Pay™</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">Rent. Automatically. Get rewarded.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Make rent payments simple, build your verified rental history, and potentially unlock savings by using Autopay.
      </p>

      {property && (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold text-ink-900">Your Rental Savings</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Base Rent</span>
              <span>${property.rent.toLocaleString()}/mo</span>
            </div>
            {applied.map((a) => (
              <div key={a.type} className="flex justify-between text-brand-700">
                <span>{a.label}</span>
                <span>-${(a.discountCents / 100).toLocaleString()}/mo</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-ink-900">
              <span>Potential effective monthly cost</span>
              <span>${((effectiveRentCents ?? property.rent * 100) / 100).toLocaleString()}/mo</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Eligible incentives only apply once you actually qualify — see{" "}
            <Link to="/rewards" className="font-medium text-brand-700 hover:underline">
              Perfect Rewards™
            </Link>{" "}
            for a full breakdown.
          </p>
        </Card>
      )}

      <Card className="mt-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Perfect Pay Autopay</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${autopayOn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {autopayOn ? "🟢 AUTOPAY ACTIVE" : "Not enrolled"}
          </span>
        </div>

        {autopayOn ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Next payment</p>
              <p className="font-semibold text-ink-900">
                ${(effectiveRentCents !== null ? effectiveRentCents / 100 : (property?.rent ?? 0)).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Due</p>
              <p className="font-semibold text-ink-900">{nextDueDate ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Payment method</p>
              <p className="text-ink-900">
                {tenant?.payment_method_type === "bank" ? "Bank account" : "Debit card"} •••• {tenant?.payment_method_last4}
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li>✓ Automatic rent payments</li>
            <li>✓ Never forget rent</li>
            <li>✓ Build verified payment history</li>
            <li>✓ Potentially unlock rent savings</li>
            <li>✓ Strengthen your Perfect10ant Passport™</li>
          </ul>
        )}

        <Link to="/perfect-pay/setup">
          <Button className="mt-4 w-full">{autopayOn ? "Manage Perfect Pay" : "Set Up Perfect Pay"}</Button>
        </Link>
      </Card>

      <Card className="mt-4 p-6 text-center">
        <p className="text-4xl">{LEVEL_EMOJI[level]}</p>
        <p className="mt-2 text-lg font-semibold text-ink-900">Perfect Pay — {levelLabel(level)}</p>
        <p className="mt-1 text-sm text-slate-500">Verified on-time payments: {streak}</p>

        {next ? (
          <>
            <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-500" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {streak} / {next.consecutive_payments_required} payments toward {levelLabel(next.level)}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-brand-700">You've reached the highest Perfect Pay level.</p>
        )}
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Perfect Pay History</h2>
        <p className="mt-1 text-xs text-slate-400">
          Every entry here came from a landlord confirming your payment — nothing is marked verified without that
          confirmation.
        </p>
        <div className="mt-3 text-sm">
          {payments.length === 0 && <p className="text-slate-500">No payments recorded yet.</p>}
          {[...payments]
            .sort((a, b) => b.period_start.localeCompare(a.period_start))
            .map((p) => (
              <PaymentDisputeRow
                key={p.id}
                payment={p}
                rentDollars={property?.rent ?? null}
                dispute={disputes.find((d) => d.payment_verification_id === p.id)}
                refund={refunds.find((r) => r.payment_verification_id === p.id)}
                onFileDispute={(category, reason) => handleFileDispute(p.id, category, reason)}
              />
            ))}
        </div>
      </Card>

      {events.length > 0 && (
        <Card className="mt-4 p-6">
          <h2 className="font-semibold text-ink-900">Milestones</h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            {events.map((e) => (
              <li key={e.id}>
                {e.body}
                <span className="ml-2 text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
