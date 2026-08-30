import type { IncentiveType, JurisdictionRule } from "@/types/domain";

// Permissive-by-default: an incentive is allowed unless an explicit rule for
// that (state, type) says otherwise. See the compliance-stub note in
// supabase/migrations/0005_perfect_rent_pay_rewards.sql — this is NOT real
// legal data, just a real gate an admin can restrict.
export function buildJurisdictionAllowed(rules: JurisdictionRule[], state: string): (type: IncentiveType) => boolean {
  return (type: IncentiveType) => {
    const rule = rules.find((r) => r.state === state && r.incentive_type === type);
    return rule ? rule.allowed : true;
  };
}
