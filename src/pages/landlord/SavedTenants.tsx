import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { VerificationBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { TenantSummary } from "@/types/domain";

export function LandlordSavedTenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listSavedTenants(user.id).then(setTenants);
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Saved tenants</h1>
      <div className="mt-6 space-y-4">
        {tenants.length === 0 && <p className="text-sm text-slate-500">No saved tenants yet.</p>}
        {tenants.map((t) => (
          <Card key={t.tenant.user_id} className="p-4">
            <p className="font-medium text-slate-900">{t.user.email}</p>
            <p className="mt-1 text-sm text-slate-600">{t.tenant.intro_text || "No intro provided."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <VerificationBadge status={t.verification.identity} />
              <VerificationBadge status={t.verification.income} />
              <VerificationBadge status={t.verification.credit} />
              <VerificationBadge status={t.verification.background} />
              <VerificationBadge status={t.verification.eviction} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
