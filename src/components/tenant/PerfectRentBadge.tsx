import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { computePerfectRent } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import type { JurisdictionRule, RentIncentive } from "@/types/domain";

// Property-card badge: the "up to" maximum a tenant could ever save here —
// assumes a tenant who qualifies for every non-upfront-rent incentive and
// meets the longest lease requirement. This is a ceiling, not a promise —
// see PerfectRentCalculator for a specific tenant's real, current quote.
export function PerfectRentBadge({ propertyId, rentCents, state }: { propertyId: string; rentCents: number; state: string }) {
  const [incentives, setIncentives] = useState<RentIncentive[]>([]);
  const [rules, setRules] = useState<JurisdictionRule[]>([]);

  useEffect(() => {
    api.listRentIncentives(propertyId).then(setIncentives);
    api.listJurisdictionRules().then(setRules);
  }, [propertyId]);

  const enabled = incentives.filter((i) => i.enabled);
  if (enabled.length === 0) return null;

  const maxLeaseMonths = Math.max(0, ...enabled.map((i) => i.requires_lease_months ?? 0));
  const quote = computePerfectRent({
    baseRentCents: rentCents,
    incentives: enabled,
    jurisdictionAllowed: buildJurisdictionAllowed(rules, state),
    qualifies: { passport_verified: true, rental_history: true, auto_payment: true },
    chosenLeaseMonths: maxLeaseMonths,
  });

  if (quote.potentialMonthlySavingsCents <= 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
      💰 Perfect Rent™ available — save up to ${(quote.potentialMonthlySavingsCents / 100).toLocaleString()}/mo
    </div>
  );
}
