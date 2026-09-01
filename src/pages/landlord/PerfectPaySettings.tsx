import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { LandlordPayoutAccount, PayoutSchedule, PlatformFeeConfig } from "@/types/domain";

const SCHEDULES: PayoutSchedule[] = ["daily", "weekly", "monthly"];

export function LandlordPerfectPaySettings() {
  const { user } = useAuth();
  const [account, setAccount] = useState<LandlordPayoutAccount | null>(null);
  const [feeConfig, setFeeConfig] = useState<PlatformFeeConfig | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function load() {
    if (!user) return;
    const [a, f] = await Promise.all([api.getLandlordPayoutAccount(user.id), api.getPlatformFeeConfig()]);
    setAccount(a);
    setFeeConfig(f);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleConnect() {
    if (!user) return;
    setConnecting(true);
    try {
      // Simulated instant "connect" — a real integration redirects to the
      // provider's own onboarding flow and only marks this connected once
      // that flow actually completes (see the domain.ts note above
      // LandlordPayoutAccount).
      await api.connectLandlordPayoutAccount(user.id, String(1000 + Math.floor(Math.random() * 9000)));
      await load();
    } finally {
      setConnecting(false);
    }
  }

  async function handleSchedule(schedule: PayoutSchedule) {
    if (!user) return;
    await api.updateLandlordPayoutSchedule(user.id, schedule);
    await load();
  }

  if (!account) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Perfect Pay™ settings</h1>
      <p className="mt-1 text-sm text-slate-500">Connect a payout account and manage rent collection incentives.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Rent Collection</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${account.connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {account.connected ? "🟢 Connected" : "Not connected"}
          </span>
        </div>

        {account.connected ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-slate-600">Payout account: •••• {account.last4}</p>
            <label className="flex items-center gap-2 text-slate-600">
              Payout schedule
              <select
                value={account.payout_schedule}
                onChange={(e) => handleSchedule(e.target.value as PayoutSchedule)}
                className="rounded-lg border border-slate-300 px-2 py-1"
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Connect a payout account to collect rent through Perfect Pay. Simulated in this preview — no real bank
              account is collected or verified.
            </p>
            <Button className="mt-3" disabled={connecting} onClick={handleConnect}>
              {connecting ? "Connecting…" : "Connect payout account"}
            </Button>
          </>
        )}
      </Card>

      {feeConfig && (
        <Card className="mt-4 p-6">
          <h2 className="font-semibold text-ink-900">Platform fees</h2>
          <p className="mt-2 text-sm text-slate-600">
            {feeConfig.percent_fee > 0 || feeConfig.flat_fee_cents > 0
              ? `${feeConfig.percent_fee}% + $${(feeConfig.flat_fee_cents / 100).toFixed(2)} per rent payment, paid by the ${feeConfig.fee_payer}.`
              : "No platform fee is currently configured."}
          </p>
          <p className="mt-1 text-xs text-slate-400">Set by Perfect10ant admin — never hard-coded per landlord.</p>
        </Card>
      )}

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Autopay incentives</h2>
        <p className="mt-2 text-sm text-slate-600">
          Configure the Automatic payment discount, who funds it, and which lease length it requires from each
          property's listing page.
        </p>
      </Card>
    </div>
  );
}
