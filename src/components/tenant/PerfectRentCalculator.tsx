import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { computePerfectRent, type AppliedIncentive } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type JurisdictionRule, type RentIncentive, type TenantSummary } from "@/types/domain";

const STATUS_LABEL: Record<AppliedIncentive["status"], string> = {
  applied: "✓ Applied",
  available: "Available if you qualify",
  unavailable_location: "Unavailable in this location",
  requires_landlord_confirmation: "Ask your landlord",
};

const STATUS_TONE: Record<AppliedIncentive["status"], string> = {
  applied: "text-brand-700",
  available: "text-slate-400",
  unavailable_location: "text-slate-300 line-through",
  requires_landlord_confirmation: "text-amber-600",
};

export function PerfectRentCalculator({
  propertyId,
  rentCents,
  state,
  propertyLeaseTermMonths,
}: {
  propertyId: string;
  rentCents: number;
  state: string;
  propertyLeaseTermMonths: number;
}) {
  const { user } = useAuth();
  const [incentives, setIncentives] = useState<RentIncentive[]>([]);
  const [rules, setRules] = useState<JurisdictionRule[]>([]);
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [autoPayEnrolled, setAutoPayEnrolled] = useState(false);
  const [chosenLeaseMonths, setChosenLeaseMonths] = useState(propertyLeaseTermMonths);
  const [upfrontRentInterest, setUpfrontRentInterest] = useState(false);

  useEffect(() => {
    api.listRentIncentives(propertyId).then(setIncentives);
    api.listJurisdictionRules().then(setRules);
  }, [propertyId]);

  useEffect(() => {
    if (!user || user.role !== "tenant") return;
    api.getTenantSummary(user.id).then((s) => {
      setSummary(s);
      if (s) setChosenLeaseMonths(s.tenant.lease_pref_months ?? propertyLeaseTermMonths);
    });
    api.getOwnAutoPaymentEnrollment(user.id).then(setAutoPayEnrolled);
  }, [user, propertyLeaseTermMonths]);

  const enabled = incentives.filter((i) => i.enabled);
  if (enabled.length === 0) return null;

  const rentalReady = summary ? computeRentalReady(summary.verification) : null;
  const quote = computePerfectRent({
    baseRentCents: rentCents,
    incentives: enabled,
    jurisdictionAllowed: buildJurisdictionAllowed(rules, state),
    qualifies: {
      passport_verified: rentalReady?.level === "rental_ready",
      rental_history: summary?.verification.rentalHistory === "verified",
      auto_payment: autoPayEnrolled,
    },
    chosenLeaseMonths,
    upfrontRentInterest,
  });

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-serif text-lg font-semibold text-ink-900">Your Perfect Rent™</h2>
      <p className="mt-1 text-xs text-slate-500">
        Actual rent and eligibility are determined by the landlord's published rental terms and
        applicable laws. Nothing below is guaranteed until eligibility is confirmed.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Lease length
          <select
            value={chosenLeaseMonths}
            onChange={(e) => setChosenLeaseMonths(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-2 py-1"
          >
            {[6, 12, 18, 24, 36].map((m) => (
              <option key={m} value={m}>
                {m} months
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={upfrontRentInterest} onChange={(e) => setUpfrontRentInterest(e.target.checked)} />
          I'm interested in a qualifying upfront-rent arrangement
        </label>
      </div>

      {!user && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>{" "}
          to see which incentives your own Passport currently qualifies for.
        </p>
      )}

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Base Rent</span>
          <span>${(rentCents / 100).toLocaleString()}/mo</span>
        </div>
        {quote.applied.map((a) => (
          <div key={a.type} className="flex justify-between">
            <span className={STATUS_TONE[a.status]}>
              {a.label} <span className="text-xs">({STATUS_LABEL[a.status]})</span>
            </span>
            <span className={a.status === "applied" ? "text-brand-700" : "text-slate-400"}>
              -${(a.discountCents / 100).toLocaleString()}/mo
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-ink-900">
          <span>Estimated Rent</span>
          <span>${(quote.estimatedRentCents / 100).toLocaleString()}/mo</span>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-center">
        <p className="text-xs uppercase tracking-wide text-brand-600">Potential Annual Savings</p>
        <p className="text-xl font-semibold text-brand-700">${(quote.potentialAnnualSavingsCents / 100).toLocaleString()}/year</p>
      </div>
    </Card>
  );
}
