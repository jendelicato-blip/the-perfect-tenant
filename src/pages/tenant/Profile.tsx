import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { VerificationBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { TenantSummary } from "@/types/domain";

export function TenantProfile() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
  }, [user]);

  if (!summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const rows: [string, keyof TenantSummary["verification"]][] = [
    ["Identity verification", "identity"],
    ["Income verification", "income"],
    ["Credit screening", "credit"],
    ["Background screening", "background"],
    ["Eviction screening", "eviction"],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
        <Link to="/onboarding" className="text-sm font-medium text-brand-600 hover:underline">
          Edit preferences
        </Link>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-slate-900">About</h2>
        <p className="mt-1 text-sm text-slate-600">{summary.tenant.intro_text || "No intro yet."}</p>
        <p className="mt-2 text-xs text-slate-500">Household size: {summary.tenant.household_size}</p>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Verification status</h2>
        <p className="mt-1 text-xs text-slate-500">
          Phase 1 uses placeholder statuses — no live verification provider is connected yet.
        </p>
        <div className="mt-4 space-y-3">
          {rows.map(([label, key]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-700">{label}</span>
              <VerificationBadge status={summary.verification[key]} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Search preferences</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-400">Rent range</dt>
            <dd className="text-slate-800">${summary.preferences.min_rent}–${summary.preferences.max_rent}/mo</dd>
          </div>
          <div>
            <dt className="text-slate-400">Beds / baths</dt>
            <dd className="text-slate-800">{summary.preferences.beds}+ / {summary.preferences.baths}+</dd>
          </div>
          <div>
            <dt className="text-slate-400">Move-in date</dt>
            <dd className="text-slate-800">{summary.preferences.move_in_date}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Areas</dt>
            <dd className="text-slate-800">
              {summary.areas.map((a) => `${a.city} (${a.radius_miles}mi)`).join(", ") || "None set"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
