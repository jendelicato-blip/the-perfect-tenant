import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { computeOnTimeStreak, computePerfectPayLevel, type PaymentVerification, type PerfectPayLevel, type PerfectPayMilestone, type RewardEvent } from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = {
  new: "⚪",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

function levelLabel(level: PerfectPayLevel): string {
  return level[0].toUpperCase() + level.slice(1);
}

export function TenantPerfectPay() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [events, setEvents] = useState<RewardEvent[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listPaymentVerificationsForTenant(user.id).then(setPayments);
    api.listPerfectPayMilestones().then(setMilestones);
    api.listRewardEvents(user.id).then(setEvents);
  }, [user]);

  if (milestones.length === 0) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const streak = computeOnTimeStreak(payments);
  const { level, next } = computePerfectPayLevel(streak, milestones);
  const progressTarget = next?.consecutive_payments_required ?? milestones[milestones.length - 1].consecutive_payments_required;
  const progressPct = progressTarget > 0 ? Math.min(100, Math.round((streak / progressTarget) * 100)) : 100;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect Pay™</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">Pay on time. Build your rental reputation.</h1>

      <Card className="mt-6 p-6 text-center">
        <p className="text-4xl">{LEVEL_EMOJI[level]}</p>
        <p className="mt-2 text-lg font-semibold text-ink-900">Perfect Pay — {levelLabel(level)}</p>
        <p className="mt-1 text-sm text-slate-500">Consecutive on-time payments: {streak}</p>

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

        <p className="mt-4 text-sm text-slate-600">
          Keep building your Perfect Pay history to unlock additional rewards — see{" "}
          <a href="/rewards" className="font-medium text-brand-700 hover:underline">
            Perfect Rewards™
          </a>
          .
        </p>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Verified payment history</h2>
        <p className="mt-1 text-xs text-slate-400">
          Every entry here came from a landlord confirming your payment — nothing is marked
          verified without that confirmation (Phase 1 has no bank/payment-processor integration).
        </p>
        <div className="mt-3 space-y-1 text-sm">
          {payments.length === 0 && <p className="text-slate-500">No payments recorded yet.</p>}
          {[...payments]
            .sort((a, b) => b.period_start.localeCompare(a.period_start))
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
                <span className="text-slate-600">{new Date(p.period_start).toLocaleDateString(undefined, { year: "numeric", month: "long" })}</span>
                <Badge tone={p.status === "on_time" ? "success" : p.status === "late" ? "warning" : "default"}>{p.status.replace("_", " ")}</Badge>
              </div>
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
