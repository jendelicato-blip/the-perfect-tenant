import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import type { MarketplaceTenant } from "@/lib/data/api";
import { Badge, RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { InlineLogo } from "@/components/Logo";
import { computeRentalReady, type PropertyWithPhotos } from "@/types/domain";

export function LandlordMarketplace() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [tenants, setTenants] = useState<MarketplaceTenant[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [invitedTenantIds, setInvitedTenantIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.listPropertiesForLandlord(user.id).then((props) => {
      setProperties(props);
      if (props[0]) setPropertyId(props[0].id);
    });
    api.listSavedTenants(user.id).then((saved) => setSavedIds(new Set(saved.map((s) => s.tenant.user_id))));
    api.listInvitationsForLandlord(user.id).then((invites) => setInvitedTenantIds(new Set(invites.map((i) => i.tenant_id))));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.listMarketplaceTenants(user.id, propertyId || undefined).then((result) => {
      setTenants(result);
      setLoading(false);
    });
  }, [user, propertyId]);

  async function handleSave(tenantId: string) {
    if (!user) return;
    const nowSaved = await api.toggleSavedTenant(user.id, tenantId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(tenantId);
      else next.delete(tenantId);
      return next;
    });
  }

  async function handleInvite(tenantId: string) {
    if (!user || !propertyId) return;
    await api.createInvitation(user.id, tenantId, propertyId);
    setInvitedTenantIds((prev) => new Set(prev).add(tenantId));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">
        Find Your <InlineLogo className="h-7 w-auto" />
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Rental Ready, verified tenants actively searching for housing — matched against your listing.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="max-w-xs flex-1">
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Browse without scoring</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </Select>
        </div>
        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            verifiedOnly ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          🏅 Perfect10ant Verified only
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && tenants.length === 0 && <p className="text-sm text-slate-500">No Rental Ready tenants found yet.</p>}
        {!loading &&
          tenants.length > 0 &&
          tenants.filter((t) => !verifiedOnly || t.tenant.perfect10antVerified).length === 0 && (
            <p className="text-sm text-slate-500">No tenants match the selected filter.</p>
          )}
        {tenants
          .filter((t) => !verifiedOnly || t.tenant.perfect10antVerified)
          .map(({ tenant, score, reasons }) => {
          const rentalReady = computeRentalReady(tenant.verification);
          const invited = invitedTenantIds.has(tenant.tenant.user_id);
          return (
            <Card key={tenant.tenant.user_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/landlord/tenants/${tenant.tenant.user_id}`} className="font-semibold text-slate-900 hover:underline">
                    {tenant.user.email.split("@")[0]}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <RentalReadyBadge level={rentalReady.level} />
                    {score !== null && <Badge tone={score >= 70 ? "success" : score >= 40 ? "warning" : "default"}>{score}% Match</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    📍 {tenant.areas.map((a) => a.city).join(", ") || "—"} · 💰 ${tenant.preferences.min_rent.toLocaleString()}–${tenant.preferences.max_rent.toLocaleString()} · 🛏 {tenant.preferences.beds}+ bd · 📅 {tenant.preferences.move_in_date}
                    {tenant.preferences.pets ? " · 🐕 Has pet(s)" : ""}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadge status={tenant.verification.identity} />
                <VerificationBadge status={tenant.verification.income} />
                <VerificationBadge status={tenant.verification.employment} />
                <VerificationBadge status={tenant.verification.credit} />
                <VerificationBadge status={tenant.verification.background} />
              </div>

              {reasons && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {reasons.filter((r) => r.matched).slice(0, 4).map((r) => (
                    <li key={r.label}>✓ {r.label}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/landlord/tenants/${tenant.tenant.user_id}`}>
                  <Button variant="secondary">View Passport</Button>
                </Link>
                <Button onClick={() => handleInvite(tenant.tenant.user_id)} disabled={!propertyId || invited}>
                  {invited ? "Invited" : "Invite to Apply"}
                </Button>
                <button
                  onClick={() => handleSave(tenant.tenant.user_id)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  {savedIds.has(tenant.tenant.user_id) ? "★ Saved" : "☆ Save"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
