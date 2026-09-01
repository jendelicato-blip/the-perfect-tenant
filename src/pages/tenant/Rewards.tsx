import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { computePerfectRent } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  computeRentalReady,
  type Application,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type RentalReadyLevel,
  type TenantSummary,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = { new: "⚪", bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

const STATUS_META: Record<RentalReadyLevel, { emoji: string; label: string; classes: string }> = {
  rental_ready: { emoji: "🟢", label: "Rental Ready", classes: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  almost_ready: { emoji: "🟡", label: "Almost Ready", classes: "border-amber-200 bg-amber-50 text-amber-800" },
  action_required: { emoji: "🔴", label: "Action Required", classes: "border-red-200 bg-red-50 text-red-800" },
};

// A larger, more prominent status pill for the Rewards hero card — the
// shared RentalReadyBadge (used compactly across 8+ other pages) stays as-is.
function StatusButton({ level }: { level: RentalReadyLevel }) {
  const meta = STATUS_META[level];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-sm ${meta.classes}`}>
      <span className="text-base">{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

const FUTURE_CATEGORIES = [
  { icon: "💳", title: "Financial", body: "Potential future partner offers." },
  { icon: "🛡️", title: "Insurance", body: "Potential renter's insurance discounts through approved partners." },
  { icon: "🚚", title: "Moving", body: "Potential moving-service discounts." },
  { icon: "🧹", title: "Home Services", body: "Potential discounts from participating service providers." },
  { icon: "📡", title: "Utilities", body: "Potential partner offers for internet, electricity, and other utilities." },
];

export function TenantRewards() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [potentialSavingsCents, setPotentialSavingsCents] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
    api.listPaymentVerificationsForTenant(user.id).then(setPayments);
    api.listPerfectPayMilestones().then(setMilestones);
    api.listApplicationsForTenant(user.id).then(setApplications);
  }, [user]);

  useEffect(() => {
    if (!user || !summary) return;
    const approved = applications.find((a) => a.status === "approved");
    if (!approved) return;
    (async () => {
      const property = await api.getProperty(approved.property_id);
      if (!property) return;
      const [incentives, rules, autoPay] = await Promise.all([
        api.listRentIncentives(property.id),
        api.listJurisdictionRules(),
        api.getOwnAutoPaymentEnrollment(user.id),
      ]);
      const rentalReady = computeRentalReady(summary.verification);
      const quote = computePerfectRent({
        baseRentCents: property.rent * 100,
        incentives: incentives.filter((i) => i.enabled),
        jurisdictionAllowed: buildJurisdictionAllowed(rules, property.state),
        qualifies: {
          passport_verified: rentalReady.level === "rental_ready",
          rental_history: summary.verification.rentalHistory === "verified",
          auto_payment: autoPay,
        },
        chosenLeaseMonths: property.lease_term_months,
      });
      setPotentialSavingsCents(quote.potentialAnnualSavingsCents);
    })();
  }, [user, summary, applications]);

  if (!summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const rentalReady = computeRentalReady(summary.verification);
  const passportComplete = Math.round((rentalReady.completed / rentalReady.total) * 100);
  const streak = computeOnTimeStreak(payments);
  const { level } = computePerfectPayLevel(streak, milestones);
  const verifiedLeaseCount = new Set(applications.filter((a) => a.status === "approved").map((a) => a.property_id)).size;

  const badges = [
    { earned: rentalReady.level === "rental_ready", icon: "🏆", label: "Rental Ready", body: "Completed verification" },
    { earned: level !== "new", icon: "💳", label: `Perfect Pay ${level !== "new" ? level[0].toUpperCase() + level.slice(1) : ""}`, body: "Consistent verified payments" },
    { earned: verifiedLeaseCount > 0, icon: "🏠", label: "Experienced Renter", body: "Verified rental history" },
    { earned: passportComplete === 100, icon: "⭐", label: "Perfect Passport", body: "Profile fully updated" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect Rewards™</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">
        The better your rental profile, the more benefits you can unlock.
      </h1>

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <img src="/logo-horizontal.png" alt="The Perfect10ant" className="h-8 w-auto" />
          <StatusButton level={rentalReady.level} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">Passport</dt>
            <dd className="font-semibold text-ink-900">{passportComplete}% Complete</dd>
          </div>
          <div>
            <dt className="text-slate-400">Perfect Pay</dt>
            <dd className="font-semibold text-ink-900">
              {LEVEL_EMOJI[level]} {level[0].toUpperCase() + level.slice(1)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Rental History</dt>
            <dd className="font-semibold text-ink-900">{verifiedLeaseCount} Verified Lease{verifiedLeaseCount === 1 ? "" : "s"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Rewards</dt>
            <dd className="font-semibold text-brand-700">${(potentialSavingsCents / 100).toLocaleString()} Potential Annual Savings</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Achievements</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => (
            <div key={b.label} className={`rounded-lg border p-3 text-center ${b.earned ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50 opacity-50"}`}>
              <p className="text-2xl">{b.icon}</p>
              <p className="mt-1 text-xs font-semibold text-ink-900">{b.label}</p>
              <p className="text-[11px] text-slate-500">{b.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">🏠 Renting</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>
            Rent discounts — see your{" "}
            <Link to="/perfect-pay" className="font-medium text-brand-700 hover:underline">
              Perfect Pay™
            </Link>{" "}
            status and any listing's{" "}
            <span className="font-medium">Perfect Rent™</span> options
          </li>
          <li>Reduced qualifying fees, move-in incentives, and lease-renewal incentives depend on individual landlord participation.</li>
        </ul>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Future benefit categories</h2>
        <p className="mt-1 text-xs text-slate-400">
          Not live yet — no partner offers exist today. Shown so you know what's planned, not what's
          available.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FUTURE_CATEGORIES.map((c) => (
            <div key={c.title} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span>{c.icon}</span>
                <span className="text-sm font-semibold text-ink-900">{c.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Coming soon</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{c.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
