import { INCENTIVE_LABELS, type IncentiveType, type RentIncentive } from "@/types/domain";

// Perfect Rent™ calculator. Pure function — no data fetching — so it can run
// identically in the interactive calculator, on a property card, and in the
// Perfect Match™ integration.
//
// Honesty rules baked into the shape of the output, not just the UI:
//  - Only a discount the tenant *actually* qualifies for right now
//    (passport_verified / rental_history / auto_payment / longer_lease with
//    a real chosen lease length) is subtracted into estimatedRentCents.
//  - upfront_rent NEVER auto-qualifies — there is no real signal that a
//    tenant has actually agreed to/completed such an arrangement, so it
//    always reports status "requires_landlord_confirmation" and is never
//    subtracted from the estimated rent, only shown as a possibility to ask
//    the landlord about.
//  - An incentive a jurisdiction rule disallows is surfaced as
//    "unavailable_location", never silently applied.

export interface PerfectRentInputs {
  baseRentCents: number;
  incentives: RentIncentive[];
  jurisdictionAllowed: (type: IncentiveType) => boolean;
  qualifies: {
    passport_verified: boolean;
    rental_history: boolean;
    auto_payment: boolean;
  };
  chosenLeaseMonths?: number | null;
  upfrontRentInterest?: boolean;
}

export type AppliedIncentiveStatus = "applied" | "available" | "unavailable_location" | "requires_landlord_confirmation";

export interface AppliedIncentive {
  type: IncentiveType;
  label: string;
  discountCents: number;
  requiresLeaseMonths: number | null;
  status: AppliedIncentiveStatus;
}

export interface PerfectRentQuote {
  baseRentCents: number;
  applied: AppliedIncentive[];
  estimatedRentCents: number;
  potentialMonthlySavingsCents: number;
  potentialAnnualSavingsCents: number;
}

export function computePerfectRent(inputs: PerfectRentInputs): PerfectRentQuote {
  const applied: AppliedIncentive[] = [];
  let totalDiscountCents = 0;

  for (const incentive of inputs.incentives.filter((i) => i.enabled)) {
    const label = INCENTIVE_LABELS[incentive.type];

    if (!inputs.jurisdictionAllowed(incentive.type)) {
      applied.push({ type: incentive.type, label, discountCents: incentive.discount_cents, requiresLeaseMonths: incentive.requires_lease_months, status: "unavailable_location" });
      continue;
    }

    if (incentive.type === "upfront_rent") {
      applied.push({
        type: incentive.type,
        label,
        discountCents: incentive.discount_cents,
        requiresLeaseMonths: null,
        status: "requires_landlord_confirmation",
      });
      continue;
    }

    let qualifies: boolean;
    switch (incentive.type) {
      case "passport_verified":
        qualifies = inputs.qualifies.passport_verified;
        break;
      case "rental_history":
        qualifies = inputs.qualifies.rental_history;
        break;
      case "auto_payment":
        qualifies = inputs.qualifies.auto_payment;
        break;
      case "longer_lease":
        qualifies =
          inputs.chosenLeaseMonths != null &&
          incentive.requires_lease_months != null &&
          inputs.chosenLeaseMonths >= incentive.requires_lease_months;
        break;
      default:
        qualifies = false;
    }

    if (qualifies) {
      totalDiscountCents += incentive.discount_cents;
    }
    applied.push({
      type: incentive.type,
      label,
      discountCents: incentive.discount_cents,
      requiresLeaseMonths: incentive.requires_lease_months,
      status: qualifies ? "applied" : "available",
    });
  }

  const estimatedRentCents = Math.max(0, inputs.baseRentCents - totalDiscountCents);
  return {
    baseRentCents: inputs.baseRentCents,
    applied,
    estimatedRentCents,
    potentialMonthlySavingsCents: totalDiscountCents,
    potentialAnnualSavingsCents: totalDiscountCents * 12,
  };
}
