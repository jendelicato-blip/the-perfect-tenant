import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  computeRentalReady,
  REQUIRED_VERIFICATIONS,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type TenantSummary,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = { new: "⚪", bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

export function LandlordTenantPassportView() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    api.getTenantSummary(tenantId).then(setSummary);
    if (user) api.recordPassportView(tenantId, user.id);
    // RLS only lets a landlord read payment_verifications rows where they
    // are the recording landlord (payment_verifications_landlord_all) — so
    // this only ever shows Perfect Pay history this landlord themselves
    // verified for this tenant, never another landlord's. A tenant's full
    // cross-landlord history following them (see the domain.ts note on
    // that) needs a real public-safe aggregate view, deferred for now.
    if (user) {
      api.listPaymentVerificationsForLandlord(user.id).then((all) => setPayments(all.filter((p) => p.tenant_id === tenantId)));
    }
    api.listPerfectPayMilestones().then(setMilestones);
  }, [tenantId, user]);

  if (!summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading Passport…</div>;

  const rentalReady = computeRentalReady(summary.verification);

  async function handleMessage() {
    if (!user || !tenantId) return;
    const conversation = await api.getOrCreateConversation(tenantId, user.id, null);
    navigate(`/messages/${conversation.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/landlord/tenants" className="mb-4" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect10ant Passport™</p>
          <h1 className="text-2xl font-bold text-slate-900">{summary.user.email.split("@")[0]}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RentalReadyBadge level={rentalReady.level} />
          {summary.perfect10antVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700">
              🏅 Verified
            </span>
          )}
        </div>
      </div>

      <Card className="mt-6 p-6">
        <p className="text-sm text-slate-600">{summary.tenant.intro_text || "No intro provided."}</p>
        <p className="mt-1 text-xs text-slate-400">Household size: {summary.tenant.household_size}</p>
      </Card>

      {payments.length > 0 && milestones.length > 0 && (
        <Card className="mt-4 p-6">
          <h2 className="font-semibold text-slate-900">Perfect Pay™</h2>
          <p className="mt-2 text-2xl">
            {LEVEL_EMOJI[computePerfectPayLevel(computeOnTimeStreak(payments), milestones).level]}{" "}
            {computePerfectPayLevel(computeOnTimeStreak(payments), milestones).level[0].toUpperCase() +
              computePerfectPayLevel(computeOnTimeStreak(payments), milestones).level.slice(1)}
          </p>
          <p className="text-sm text-slate-500">{computeOnTimeStreak(payments)} verified on-time payments</p>
          <p className="mt-2 text-xs text-slate-400">Payment history verified by Perfect10ant.</p>
        </Card>
      )}

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Verification</h2>
        <div className="mt-3 space-y-2">
          {REQUIRED_VERIFICATIONS.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 capitalize">{r.label}</span>
              <VerificationBadge status={summary.verification[r.key]} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Rental Preferences</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>📍 {summary.areas.map((a) => a.city).join(", ") || "—"}</li>
          <li>💰 ${summary.preferences.min_rent.toLocaleString()}–${summary.preferences.max_rent.toLocaleString()}/month</li>
          <li>🛏 {summary.preferences.beds}+ bedrooms</li>
          <li>📅 Available {summary.preferences.move_in_date}</li>
          <li>📄 {summary.tenant.lease_pref_months ?? "Flexible"}-month lease preference</li>
        </ul>
      </Card>

      <div className="mt-6">
        <Button variant="secondary" onClick={handleMessage}>
          Message
        </Button>
      </div>
    </div>
  );
}
