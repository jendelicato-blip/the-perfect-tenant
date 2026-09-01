import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import type { PassportViewWithViewer } from "@/lib/data/api";
import { Badge, RentalReadyBadge, VerificationBadge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Logo } from "@/components/Logo";
import {
  computeOnTimeStreak,
  computePerfectPayLevel,
  computeRentalReady,
  REQUIRED_VERIFICATIONS,
  type Application,
  type PassportShare,
  type PaymentVerification,
  type PerfectPayLevel,
  type PerfectPayMilestone,
  type TenantSummary,
} from "@/types/domain";

const LEVEL_EMOJI: Record<PerfectPayLevel, string> = { new: "⚪", bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };

// Same derivation used in AccountMenu.tsx/Home.tsx — there's no separate
// "name" field anywhere in the schema (see AccountMenu's note), only email.
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const first = local.split(/[._-]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// The QR code only ever encodes this same share link — never Passport data
// directly. Scanning it just navigates to the same revocable, expirable
// page a copied link would; there's nothing more sensitive baked into it.
function ShareRow({ share, onRevoke }: { share: PassportShare; onRevoke: () => void }) {
  const revoked = Boolean(share.revoked_at);
  const expired = Boolean(share.expires_at) && new Date(share.expires_at!) < new Date();
  const inactive = revoked || expired;
  const link = `${window.location.origin}/passport/shared/${share.share_token}`;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:flex-row sm:items-start">
      {!inactive && (
        <div className="flex-none rounded-md border border-slate-200 bg-white p-2">
          <QRCodeSVG value={link} size={88} level="M" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-slate-700">{share.landlord_id ? "Shared with a specific landlord" : "Shared via secure link"}</p>
        {!inactive && <p className="mt-1 truncate text-xs text-slate-400">{link}</p>}
        {revoked && <p className="mt-1 text-xs text-red-500">Revoked</p>}
        {!revoked && expired && <p className="mt-1 text-xs text-red-500">Expired {new Date(share.expires_at!).toLocaleDateString()}</p>}
        {!inactive && (
          <p className="mt-1 text-xs text-slate-400">
            {share.expires_at ? `Expires ${new Date(share.expires_at).toLocaleDateString()}` : "No expiration"}
          </p>
        )}
        {!inactive && (
          <div className="no-print mt-2 flex flex-none items-center gap-2">
            <button
              className="rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
              onClick={() => navigator.clipboard?.writeText(link)}
            >
              Copy link
            </button>
            <button
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
              onClick={onRevoke}
            >
              Revoke
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TenantPassport() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [shares, setShares] = useState<PassportShare[]>([]);
  const [views, setViews] = useState<PassportViewWithViewer[]>([]);
  const [creatingShare, setCreatingShare] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [milestones, setMilestones] = useState<PerfectPayMilestone[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  async function load() {
    if (!user) return;
    const [s, sh, v, pay, ms, apps] = await Promise.all([
      api.getTenantSummary(user.id),
      api.listPassportShares(user.id),
      api.listPassportViewsWithViewers(user.id),
      api.listPaymentVerificationsForTenant(user.id),
      api.listPerfectPayMilestones(),
      api.listApplicationsForTenant(user.id),
    ]);
    setSummary(s);
    setShares(sh);
    setViews(v);
    setPayments(pay);
    setMilestones(ms);
    setApplications(apps);

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
      await api.createPassportShare(user.id, null, expiresInDays ? Number(expiresInDays) : null);
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
  const streak = computeOnTimeStreak(payments);
  const { level } = milestones.length ? computePerfectPayLevel(streak, milestones) : { level: "new" as PerfectPayLevel };
  const verifiedLeaseCount = new Set(applications.filter((a) => a.status === "approved").map((a) => a.property_id)).size;
  // Real counts from the same landlord-confirmed payments record Perfect
  // Pay is built on (see PaymentVerification) — never a separate invented
  // "credit score"-style number.
  const onTimePaymentCount = payments.filter((p) => p.status === "on_time").length;
  const onTimeRate = payments.length > 0 ? Math.round((onTimePaymentCount / payments.length) * 100) : null;
  const name = displayNameFromEmail(summary.user.email);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="no-print mb-4 flex items-center justify-between">
        <BackButton fallback="/home" />
        <Button variant="secondary" onClick={() => window.print()}>
          🖨️ Print Passport
        </Button>
      </div>

      {rentalReady.nextStep && (
        <p className="no-print mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{rentalReady.nextStep}</p>
      )}

      {/* Everything a landlord needs to see or scan lives in this one card —
          #passport-card is the only element left visible by the print
          stylesheet (see index.css), so "Print Passport" produces just this,
          not the whole page. */}
      <div id="passport-card" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <Logo className="h-8 w-auto" />
          <RentalReadyBadge level={rentalReady.level} />
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect10ant Passport™</p>
              <h1 className="text-xl font-bold text-slate-900">{name}</h1>
              <p className="text-sm text-slate-500">{summary.user.email}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Perfect Pay™</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">
                {LEVEL_EMOJI[level]} {level[0].toUpperCase() + level.slice(1)}
              </p>
              <p className="text-xs text-slate-500">{streak} on-time streak</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">On-Time Rate</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{onTimeRate !== null ? `${onTimeRate}%` : "—"}</p>
              <p className="text-xs text-slate-500">{onTimePaymentCount} confirmed payments</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Verified Leases</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{verifiedLeaseCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Perfect10ant Verified™</p>
              {summary.perfect10antVerified ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-gold-700">🏅 Verified</p>
              ) : (
                <Link to="/verified" className="no-print mt-1 inline-block text-sm font-medium text-brand-700 hover:underline">
                  Get Verified →
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Verification Summary</h2>
              <Link
                to="/verification"
                className="no-print text-xs font-semibold text-brand-700 underline decoration-2 underline-offset-4 hover:text-brand-800"
              >
                View Details →
              </Link>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {REQUIRED_VERIFICATIONS.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-slate-700">{r.label.replace(/^./, (c) => c.toUpperCase())}</span>
                  <VerificationBadge status={summary.verification[r.key]} />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Share &amp; Verify</h2>
            <p className="mt-1 text-sm text-slate-600">
              You control who can see your Passport. A landlord you apply to or message can already see it — a
              share link (with its own scannable QR code) sends it anywhere else, and can be revoked any time.
            </p>
            <div className="no-print mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Expires
                <Select value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className="w-36">
                  <option value="">Never</option>
                  <option value="1">In 24 hours</option>
                  <option value="7">In 7 days</option>
                  <option value="30">In 30 days</option>
                </Select>
              </label>
              <Button onClick={handleShareLink} disabled={creatingShare}>
                {creatingShare ? "Creating…" : "Generate link + QR code"}
              </Button>
            </div>
            {shares.length > 0 ? (
              <div className="mt-4 space-y-2">
                {shares.map((s) => (
                  <ShareRow key={s.id} share={s} onRevoke={() => handleRevoke(s.id)} />
                ))}
              </div>
            ) : (
              <p className="no-print mt-3 text-sm text-slate-400">
                No share link yet — generate one above to get a scannable QR code for this Passport.
              </p>
            )}
          </div>
        </div>
      </div>

      <Card className="no-print mt-4 p-6">
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

      <Card className="no-print mt-4 p-6">
        <h2 className="font-semibold text-slate-900">Recent Passport Activity</h2>
        {views.length === 0 && <p className="mt-2 text-sm text-slate-500">No landlords have viewed your Passport yet.</p>}
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {views.map((v) => (
            <li key={v.id}>
              <span className="font-medium text-slate-900">{v.viewerCompanyName ?? v.viewerEmail}</span> viewed your Passport
              — {new Date(v.viewed_at).toLocaleString()}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="no-print mt-4 p-6">
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
