import { INCENTIVE_LABELS, type IncentiveType, type JurisdictionRule } from "@/types/domain";
import { Input } from "@/components/ui/Field";

export interface IncentiveFormState {
  enabled: boolean;
  discountDollars: number;
  requiresLeaseMonths: number;
}

export type IncentiveFormValue = Record<IncentiveType, IncentiveFormState>;

export const EMPTY_INCENTIVE_FORM: IncentiveFormValue = {
  passport_verified: { enabled: false, discountDollars: 25, requiresLeaseMonths: 0 },
  longer_lease: { enabled: false, discountDollars: 50, requiresLeaseMonths: 18 },
  auto_payment: { enabled: false, discountDollars: 25, requiresLeaseMonths: 0 },
  rental_history: { enabled: false, discountDollars: 25, requiresLeaseMonths: 0 },
  upfront_rent: { enabled: false, discountDollars: 100, requiresLeaseMonths: 0 },
};

const INCENTIVE_TYPES: IncentiveType[] = ["passport_verified", "longer_lease", "auto_payment", "rental_history", "upfront_rent"];

const INCENTIVE_HELP: Record<IncentiveType, string> = {
  passport_verified: "Tenant has completed their Perfect10ant Passport (Rental Ready).",
  longer_lease: "Tenant signs a lease at or beyond the length you require below.",
  auto_payment: "Tenant enrolls in an approved automatic rent-payment method.",
  rental_history: "Tenant has a verified prior rental history on their Passport.",
  upfront_rent: "A qualifying upfront-rent arrangement — distinct from a security deposit. Never auto-applied; always requires your confirmation at lease signing.",
};

export function RentIncentiveEditor({
  value,
  onChange,
  jurisdictionRules,
  state,
  baseRentDollars,
}: {
  value: IncentiveFormValue;
  onChange: (next: IncentiveFormValue) => void;
  jurisdictionRules: JurisdictionRule[];
  state: string;
  baseRentDollars: number;
}) {
  function isBlocked(type: IncentiveType): string | null {
    const rule = jurisdictionRules.find((r) => r.state === state && r.incentive_type === type);
    return rule && !rule.allowed ? rule.note ?? "This incentive is unavailable in this location." : null;
  }

  function update(type: IncentiveType, patch: Partial<IncentiveFormState>) {
    onChange({ ...value, [type]: { ...value[type], ...patch } });
  }

  const enabledTotal = INCENTIVE_TYPES.filter((t) => value[t].enabled && !isBlocked(t) && t !== "upfront_rent").reduce(
    (sum, t) => sum + value[t].discountDollars,
    0,
  );
  const maxPotentialRent = Math.max(0, baseRentDollars - enabledTotal);

  return (
    <div className="space-y-4">
      {INCENTIVE_TYPES.map((type) => {
        const blocked = isBlocked(type);
        const v = value[type];
        return (
          <div key={type} className={`rounded-lg border p-3 ${blocked ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200"}`}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={v.enabled}
                disabled={Boolean(blocked)}
                onChange={(e) => update(type, { enabled: e.target.checked })}
              />
              Offer {INCENTIVE_LABELS[type]}
            </label>
            <p className="mt-1 text-xs text-slate-500">{INCENTIVE_HELP[type]}</p>
            {blocked && <p className="mt-1 text-xs font-medium text-red-600">This incentive is unavailable in this location.</p>}
            {v.enabled && !blocked && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  Discount ($/mo)
                  <Input
                    type="number"
                    min={0}
                    value={v.discountDollars}
                    onChange={(e) => update(type, { discountDollars: Number(e.target.value) })}
                    className="w-24"
                  />
                </label>
                {type === "longer_lease" && (
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    Minimum lease (months)
                    <Input
                      type="number"
                      min={1}
                      value={v.requiresLeaseMonths}
                      onChange={(e) => update(type, { requiresLeaseMonths: Number(e.target.value) })}
                      className="w-20"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-lg bg-brand-50 p-4 text-sm">
        <p className="font-medium text-slate-800">Preview (excludes upfront-rent, which always requires your confirmation)</p>
        <div className="mt-2 flex justify-between">
          <span className="text-slate-600">Potential advertised rent</span>
          <span className="font-semibold text-ink-900">${baseRentDollars.toLocaleString()}/mo</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-slate-600">Potential Perfect Rent™</span>
          <span className="font-semibold text-brand-700">${maxPotentialRent.toLocaleString()}/mo</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-slate-600">Maximum potential annual tenant savings</span>
          <span className="font-semibold text-brand-700">${(enabledTotal * 12).toLocaleString()}</span>
        </div>
        {enabledTotal > 0 && (
          <p className="mt-3 border-t border-brand-100 pt-2 text-xs text-slate-500">
            Your cost if every eligible tenant qualifies for all enabled incentives: ${(enabledTotal * 12).toLocaleString()}/year —
            compared with the potential cost of one vacant month (${baseRentDollars.toLocaleString()}). Actual outcomes
            depend on your market; this isn't a guaranteed return.
          </p>
        )}
      </div>
    </div>
  );
}
