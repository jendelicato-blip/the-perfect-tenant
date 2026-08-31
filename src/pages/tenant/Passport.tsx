import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { Badge, RentalReadyBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, REQUIRED_VERIFICATIONS, type PassportShare, type PassportView, type TenantSummary } from "@/types/domain";

function ShareRow({ share, onRevoke }: { share: PassportShare; onRevoke: () => void }) {
  const revoked = Boolean(share.revoked_at);
  const link = `${window.location.origin}/passport/shared/${share.share_token}`;
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div>
        <p className="text-slate-700">{share.landlord_id ? "Shared with a specific landlord" : "Shared via secure link"}</p>
        {!revoked && <p className="truncate text-xs text-slate-400">{link}</p>}
        {revoked && <p className="text-xs text-red-500">Revoked</p>}
      </div>
      <div className="flex items-center gap-2">
        {!revoked && (
          <button
            className="text-xs font-medium text-brand-600 hover:underline"
            onClick={() => navigator.clipboard?.writeText(link)}
          >
            Copy link
          </button>
        )}
        {!revoked && (
          <button className="text-xs font-medium text-red-600 hover:underline" onClick={onRevoke}>
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

export function TenantPassport() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [shares, setShares] = useState<PassportShare[]>([]);
  const [views, setViews] = useState<PassportView[]>([]);
  const [creatingShare, setCreatingShare] = useState(false);

  async function load() {
    if (!user) return;
    const [s, sh, v] = await Promise.all([
      api.getTenantSummary(user.id),
      api.listPassportShares(user.id),
      api.listPassportViews(user.id),
    ]);
    setSummary(s);
    setShares(sh);
    setViews(v);

    if (s && computeRentalReady(s.verification).level === "rental_ready") {
      await api.notifyOnce(
        user.id,
        "perfect_rent_eligible",
        "🎉 You've completed your Perfect10ant Passport — you may now qualify for Perfect Rent™ savings on properties offering a Passport discount.",
      );
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleShareLink() {
    if (!user) return;
    setCreatingShare(true);
    try {
      await api.createPassportShare(user.id, null);
      await load();
    } finally {
      setCreatingShare(false);
    }
  }

  async function handleRevoke(shareId: string) {
    await api.revokePassportShare(shareId);
    await load();
  }

  if (!summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const rentalReady = computeRentalReady(summary.verification);
  const verifiedCategories = REQUIRED_VERIFICATIONS.filter((r) => summary.verification[r.key] === "verified");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect10ant Passport™</p>
          <h1 className="text-2xl font-bold text-slate-900">{summary.user.email.split("@")[0]}</h1>
        </div>
        <RentalReadyBadge level={rentalReady.level} />
      </div>

      {rentalReady.nextStep && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{rentalReady.nextStep}</p>
      )}

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Verification</h2>
          <Link to="/verification" className="text-sm font-medium text-brand-600 hover:underline">
            View Verification Center
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
          {REQUIRED_VERIFICATIONS.map((r) => (
            <li key={r.key}>
              {summary.verification[r.key] === "verified" ? "✓" : "○"} {r.label.replace(/^./, (c) => c.toUpperCase())}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Rental Preferences</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          <li>📍 {summary.areas.map((a) => a.city).join(", ") || "No areas set"}</li>
          <li>💰 ${summary.preferences.min_rent.toLocaleString()}–${summary.preferences.max_rent.toLocaleString()}/month</li>
          <li>🛏 {summary.preferences.beds}+ bedrooms</li>
          <li>📅 Available {summary.preferences.move_in_date}</li>
          <li>{summary.preferences.pets ? "🐕 Has pet(s)" : "No pets"}</li>
          <li>📄 {summary.tenant.lease_pref_months ?? "Flexible"}-month lease preference</li>
        </ul>
        <Link to="/onboarding" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
          Edit preferences
        </Link>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Share My Perfect10ant Passport</h2>
        <p className="mt-1 text-sm text-slate-600">
          You control who can see your Passport. A landlord you apply to or message can already see it —
          use a share link to send it anywhere else.
        </p>
        <Button className="mt-3" onClick={handleShareLink} disabled={creatingShare}>
          {creatingShare ? "Creating link…" : "Copy secure profile link"}
        </Button>
        {shares.length > 0 && (
          <div className="mt-4 space-y-2">
            {shares.map((s) => (
              <ShareRow key={s.id} share={s} onRevoke={() => handleRevoke(s.id)} />
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Recent Passport Activity</h2>
        {views.length === 0 && <p className="mt-2 text-sm text-slate-500">No landlords have viewed your Passport yet.</p>}
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {views.map((v) => (
            <li key={v.id}>A landlord viewed your Passport — {new Date(v.viewed_at).toLocaleString()}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Perfect10ant Timeline</h2>
        <ol className="mt-3 space-y-2 border-l border-slate-200 pl-4 text-sm text-slate-600">
          {verifiedCategories.length === 0 && <li className="text-slate-400">No milestones yet.</li>}
          {verifiedCategories.map((r) => (
            <li key={r.key}>
              <Badge tone="success">✓</Badge> <span className="ml-2">{r.label.replace(/^./, (c) => c.toUpperCase())} verified</span>
            </li>
          ))}
          {rentalReady.level === "rental_ready" && (
            <li>
              <Badge tone="brand">🟢</Badge> <span className="ml-2 font-medium">Rental Ready</span>
            </li>
          )}
        </ol>
      </Card>
    </div>
  );
}
