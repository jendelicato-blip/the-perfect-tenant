import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type TenantSummary } from "@/types/domain";

export function LandlordSavedTenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listSavedTenants(user.id).then(setTenants);
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Saved tenants</h1>
      <div className="mt-6 space-y-4">
        {tenants.length === 0 && <p className="text-sm text-slate-500">No saved tenants yet.</p>}
        {tenants.map((t) => {
          const rentalReady = computeRentalReady(t.verification);
          return (
            <Card key={t.tenant.user_id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/landlord/tenants/${t.tenant.user_id}`} className="font-medium text-slate-900 hover:underline">
                    {t.user.email}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">{t.tenant.intro_text || "No intro provided."}</p>
                </div>
                <RentalReadyBadge level={rentalReady.level} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadge status={t.verification.identity} />
                <VerificationBadge status={t.verification.income} />
                <VerificationBadge status={t.verification.employment} />
                <VerificationBadge status={t.verification.credit} />
                <VerificationBadge status={t.verification.background} />
                <VerificationBadge status={t.verification.eviction} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
