import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { RentalReadyBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  computeRentalReady,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type RentalReadyLevel,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = { new: "⚪", bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

interface TenantRow {
  tenantId: string;
  label: string;
  propertyAddress: string;
  rent: number;
  rentalReadyLevel: RentalReadyLevel;
  perfect10antVerified: boolean;
  autopayEnrolled: boolean;
  level: PerfectPayLevel;
  streak: number;
}

// Objective, non-discriminatory filters only — every one of these is a fact
// already shown on the tenant's own row (Rental Ready badge, Verified
// badge, Autopay). Never a filter on anything resembling a protected
// characteristic; there's structurally nothing here to misuse that way.
type Filter = "rentalReady" | "verified" | "autopay";

export function LandlordMyTenants() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Set<Filter>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [apps, properties, payments, milestones, autopayStatuses] = await Promise.all([
        api.listApplicationsForLandlord(user.id),
        api.listPropertiesForLandlord(user.id),
        api.listPaymentVerificationsForLandlord(user.id),
        api.listPerfectPayMilestones(),
        api.listLandlordTenantAutopayStatus(user.id),
      ]);
      const propertyById = new Map(properties.map((p) => [p.id, p]));
      const autopayByTenant = new Map(autopayStatuses.map((s) => [s.tenantId, s.autoPaymentEnrolled]));
      const approved = apps.filter((a) => a.status === "approved");

      const built = await Promise.all(
        approved.map(async (a): Promise<TenantRow | null> => {
          const property = propertyById.get(a.property_id);
          const summary = await api.getTenantSummary(a.tenant_id);
          if (!property || !summary) return null;
          const tenantPayments = payments.filter((p) => p.tenant_id === a.tenant_id && p.property_id === a.property_id);
          const streak = computeOnTimeStreak(tenantPayments);
          const { level } = computePerfectPayLevel(streak, milestones as PerfectPayMilestone[]);
          return {
            tenantId: a.tenant_id,
            label: summary.user.email.split("@")[0],
            propertyAddress: property.address,
            rent: property.rent,
            rentalReadyLevel: computeRentalReady(summary.verification).level,
            perfect10antVerified: summary.perfect10antVerified,
            autopayEnrolled: autopayByTenant.get(a.tenant_id) ?? false,
            level,
            streak,
          };
        }),
      );
      setRows(built.filter((r): r is TenantRow => r !== null));
      setLoading(false);
    })();
  }, [user]);

  function toggleFilter(f: Filter) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  const filtered = rows.filter((r) => {
    if (filters.has("rentalReady") && r.rentalReadyLevel !== "rental_ready") return false;
    if (filters.has("verified") && !r.perfect10antVerified) return false;
    if (filters.has("autopay") && !r.autopayEnrolled) return false;
    return true;
  });

  async function handleMessage(tenantId: string) {
    if (!user) return;
    const conversation = await api.getOrCreateConversation(tenantId, user.id, null);
    navigate(`/messages/${conversation.id}`);
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Tenants</h1>
      <p className="mt-1 text-sm text-slate-600">
        Every tenant with an approved application on one of your properties, across your whole portfolio.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          ["rentalReady", "🟢 Rental Ready"],
          ["verified", "🏅 Perfect10ant Verified"],
          ["autopay", "🟢 Autopay active"],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => toggleFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filters.has(f)
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No approved tenants yet — approved applications will show up here.</p>
      )}
      {rows.length > 0 && filtered.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No tenants match the selected filters.</p>
      )}

      <div className="mt-4 space-y-3">
        {filtered.map((r) => (
          <Card key={`${r.tenantId}-${r.propertyAddress}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-slate-900">{r.label}</p>
              <p className="text-sm text-slate-500">
                {r.propertyAddress} · ${r.rent.toLocaleString()}/month
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <RentalReadyBadge level={r.rentalReadyLevel} />
                {r.perfect10antVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-700">
                    🏅 Verified
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {LEVEL_EMOJI[r.level]} {r.level[0].toUpperCase() + r.level.slice(1)} · {r.streak} on-time
                </span>
                {r.autopayEnrolled && <span className="text-brand-700">🟢 Autopay active</span>}
              </div>
            </div>
            <div className="flex flex-none gap-2">
              <Link to={`/landlord/tenants/${r.tenantId}`}>
                <Button variant="secondary">View Passport</Button>
              </Link>
              <Button variant="secondary" onClick={() => handleMessage(r.tenantId)}>
                Message
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
