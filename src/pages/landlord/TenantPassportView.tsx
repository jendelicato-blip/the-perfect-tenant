import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, REQUIRED_VERIFICATIONS, type TenantSummary } from "@/types/domain";

export function LandlordTenantPassportView() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TenantSummary | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    api.getTenantSummary(tenantId).then(setSummary);
    if (user) api.recordPassportView(tenantId, user.id);
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect Tennant Passport™</p>
          <h1 className="text-2xl font-bold text-slate-900">{summary.user.email.split("@")[0]}</h1>
        </div>
        <RentalReadyBadge level={rentalReady.level} />
      </div>

      <Card className="mt-6 p-6">
        <p className="text-sm text-slate-600">{summary.tenant.intro_text || "No intro provided."}</p>
        <p className="mt-1 text-xs text-slate-400">Household size: {summary.tenant.household_size}</p>
      </Card>

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
