import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import type { ScoredProperty } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { computePerfectRent } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RentalReadyBadge } from "@/components/ui/Badge";
import { computeRentalReady, type Application, type TenantSummary } from "@/types/domain";

// Every other tab-bar destination gets a one-tap shortcut here, so Home
// works as a real hub — not just the 4 data-backed cards below (which stay
// as the richer widgets for Perfect Pay/Perfect Match/Perfect Rent/
// Applications).
const QUICK_LINKS: { to: string; label: string; emoji: string }[] = [
  { to: "/search", label: "Search", emoji: "🔍" },
  { to: "/saved", label: "Saved", emoji: "❤️" },
  { to: "/messages", label: "Messages", emoji: "💬" },
  { to: "/invitations", label: "Landlord Interest", emoji: "📨" },
  { to: "/passport", label: "My Passport", emoji: "🪪" },
  { to: "/partners", label: "Perfect Partners™", emoji: "🤝" },
  { to: "/rewards", label: "Rewards", emoji: "🏆" },
];

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const first = local.split(/[._-]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TenantHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [matches, setMatches] = useState<ScoredProperty[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [autopayOn, setAutopayOn] = useState(false);
  const [annualSavingsCents, setAnnualSavingsCents] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
    api.getMatchesForTenant(user.id).then(setMatches);
    api.listApplicationsForTenant(user.id).then(setApplications);
    api.getOwnAutoPaymentEnrollment(user.id).then(setAutopayOn);
  }, [user]);

  useEffect(() => {
    if (!user || !summary) return;
    (async () => {
      const rental = await api.getCurrentRentalForTenant(user.id);
      if (!rental) return;
      const [incentives, rules] = await Promise.all([
        api.listRentIncentives(rental.property.id),
        api.listJurisdictionRules(),
      ]);
      const rentalReady = computeRentalReady(summary.verification);
      const quote = computePerfectRent({
        baseRentCents: rental.property.rent * 100,
        incentives: incentives.filter((i) => i.enabled),
        jurisdictionAllowed: buildJurisdictionAllowed(rules, rental.property.state),
        qualifies: {
          passport_verified: rentalReady.level === "rental_ready",
          rental_history: summary.verification.rentalHistory === "verified",
          auto_payment: autopayOn,
        },
        chosenLeaseMonths: rental.property.lease_term_months,
      });
      setAnnualSavingsCents(quote.potentialAnnualSavingsCents);
    })();
  }, [user, summary, autopayOn]);

  if (!user || !summary) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const rentalReady = computeRentalReady(summary.verification);
  const activeApplications = applications.filter((a) => a.status === "submitted" || a.status === "reviewing").length;
  const topMatch = [...matches].sort((a, b) => b.score - a.score)[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink-900">
          {timeOfDayGreeting()}, {displayNameFromEmail(user.email)} 👋
        </h1>
        <RentalReadyBadge level={rentalReady.level} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <span className="text-xl" aria-hidden="true">
              {l.emoji}
            </span>
            {l.label}
          </Link>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Perfect Pay™</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${autopayOn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {autopayOn ? "🟢 Autopay Active" : "Not enrolled"}
          </span>
        </div>
        {annualSavingsCents > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Potential monthly savings:{" "}
            <span className="font-semibold text-brand-700">${(annualSavingsCents / 12 / 100).toLocaleString()}</span>
          </p>
        )}
        <Link to="/perfect-pay">
          <Button variant="secondary" className="mt-3 w-full">
            Manage Perfect Pay
          </Button>
        </Link>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Perfect Match™</h2>
        {topMatch ? (
          <p className="mt-1 text-sm text-slate-600">
            {topMatch.score}% match — {matches.length} home{matches.length === 1 ? "" : "s"} match your preferences
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Complete your preferences to see your matches.</p>
        )}
        <Link to="/matches">
          <Button variant="secondary" className="mt-3 w-full">
            View Matches
          </Button>
        </Link>
      </Card>

      {annualSavingsCents > 0 && (
        <Card className="mt-4 p-6">
          <h2 className="font-semibold text-ink-900">Perfect Rent™</h2>
          <p className="mt-1 text-sm text-slate-600">
            Potential savings: <span className="font-semibold text-brand-700">${(annualSavingsCents / 100).toLocaleString()}/year</span>
          </p>
          <Link to="/rewards">
            <Button variant="secondary" className="mt-3 w-full">
              View Savings
            </Button>
          </Link>
        </Card>
      )}

      <Card className="mt-4 p-6">
        <h2 className="font-semibold text-ink-900">Applications</h2>
        <p className="mt-1 text-sm text-slate-600">{activeApplications} active</p>
        <Link to="/applications">
          <Button variant="secondary" className="mt-3 w-full">
            View Applications
          </Button>
        </Link>
      </Card>
    </div>
  );
}
