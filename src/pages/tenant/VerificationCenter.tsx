import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type TenantSummary, type TenantVerificationDetails, type VerificationDetail } from "@/types/domain";

interface Row {
  label: string;
  detail: VerificationDetail;
  extra?: string;
  // Whether row.extra is data the tenant typed in themselves (income range,
  // employer name, a prior address, a reference) as opposed to something
  // with no self-reported form at all (identity, credit/background/eviction
  // screening — nothing to distinguish there since there's no tenant-entered
  // version of a credit report). Drives the explicit Tenant Provided vs.
  // Independently Verified line below — never inferred from `extra` alone,
  // since a category can have neither.
  tenantProvidable?: boolean;
}

// Every category makes explicit whether what's shown is something the
// tenant typed in themselves or something a third party actually confirmed
// — never let a self-reported value read as if it were verified just
// because it's sitting in a "Verification Center."
function VerificationRow({ row }: { row: Row }) {
  const verified = row.detail.status === "verified";
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-900">{row.label}</p>
        {row.extra && <p className="text-sm text-slate-500">{row.extra}</p>}
        {verified && row.detail.provider && (
          <p className="mt-1 text-xs text-slate-400">
            ✓ Independently Verified — verified through {row.detail.provider}
            {row.detail.verified_at && ` on ${new Date(row.detail.verified_at).toLocaleDateString()}`}
          </p>
        )}
        {!verified && row.tenantProvidable && (
          <p className="mt-1 text-xs text-amber-600">
            📝 Tenant Provided{row.extra ? " — not yet independently verified" : " — nothing entered yet"}
          </p>
        )}
        {!verified && !row.tenantProvidable && (
          <p className="mt-1 text-xs text-slate-400">Independently verified only — no tenant-provided alternative.</p>
        )}
        {row.detail.expires_at && (
          <p className="text-xs text-slate-400">Expires {new Date(row.detail.expires_at).toLocaleDateString()} — re-verification required after this date.</p>
        )}
      </div>
      <VerificationBadge status={row.detail.status} />
    </div>
  );
}

export function TenantVerificationCenter() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [details, setDetails] = useState<TenantVerificationDetails | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
    api.getTenantVerificationDetails(user.id).then(setDetails);
  }, [user]);

  if (!summary || !details) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const rentalReady = computeRentalReady(summary.verification);

  const rows: Row[] = [
    { label: "Identity", detail: details.identity },
    {
      label: "Employment",
      detail: details.employment,
      extra: details.employment.employer ? `${details.employment.title ?? "—"} at ${details.employment.employer}` : undefined,
      tenantProvidable: true,
    },
    { label: "Income", detail: details.income, extra: details.income.monthly_income_range ?? undefined, tenantProvidable: true },
    {
      label: "Rental History",
      detail: {
        status: details.rentalHistory.some((r) => r.status === "verified") ? "verified" : details.rentalHistory.length ? "pending" : "not_started",
        provider: null,
        verified_at: details.rentalHistory.find((r) => r.status === "verified")?.verified_at ?? null,
        expires_at: null,
      },
      extra: details.rentalHistory[0]?.prior_address,
      tenantProvidable: true,
    },
    { label: "Credit Screening", detail: details.credit },
    { label: "Background Screening", detail: details.background },
    { label: "Eviction Search", detail: details.eviction },
    {
      label: "References",
      detail: {
        status: details.references.some((r) => r.status === "verified") ? "verified" : details.references.length ? "pending" : "not_started",
        provider: null,
        verified_at: null,
        expires_at: null,
      },
      extra: details.references[0] ? `${details.references[0].name} (${details.references[0].relationship})` : undefined,
      tenantProvidable: true,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/passport" className="mb-4" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Verification Center</h1>
        <RentalReadyBadge level={rentalReady.level} />
      </div>
      {rentalReady.nextStep && (
        <p className="mt-2 text-sm text-slate-600">{rentalReady.nextStep}</p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        {rentalReady.completed} of {rentalReady.total} verification categories complete. Nothing here is marked
        verified unless an actual verification process returned a successful result — Phase 1 uses placeholder
        statuses since no live provider is connected yet.
      </p>

      {summary.perfect10antVerified ? (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-700">
          🏅 Perfect10ant Verified
        </p>
      ) : (
        <Link
          to="/verified"
          className="mt-3 inline-block text-sm font-semibold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
        >
          Get Perfect10ant Verified™ — independent verification, faster applications →
        </Link>
      )}

      <Card className="mt-6 divide-y divide-slate-100 p-6">
        {rows.map((row) => (
          <VerificationRow key={row.label} row={row} />
        ))}
      </Card>
    </div>
  );
}
