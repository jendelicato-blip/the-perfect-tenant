import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { computePerfectRent } from "@/lib/perfectRent/engine";
import { buildJurisdictionAllowed } from "@/lib/perfectRent/jurisdiction";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeRentalReady, type PaymentMethodType, type PropertyWithPhotos, type TenantSummary } from "@/types/domain";

const PAYMENT_DAYS = [1, 3, 5, 15];

// 5-step setup flow: method -> date -> autopay toggle -> review -> confirm.
// Everything here is simulated (see the domain.ts note above Tenant's
// payment_method_type field) — no real bank/card number is ever collected,
// only a type + a made-up-for-display last 4 digits, exactly like a real
// provider's tokenization would hand back.
export function PerfectPaySetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [methodType, setMethodType] = useState<PaymentMethodType>("bank");
  const [autopayDay, setAutopayDay] = useState(1);
  const [autopayOn, setAutopayOn] = useState(true);
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [property, setProperty] = useState<PropertyWithPhotos | null>(null);
  const [monthlySavingsCents, setMonthlySavingsCents] = useState(0);
  const [effectiveRentCents, setEffectiveRentCents] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then(setSummary);
    api.getCurrentRentalForTenant(user.id).then((rental) => setProperty(rental?.property ?? null));
  }, [user]);

  useEffect(() => {
    if (!user || !summary || !property) return;
    (async () => {
      const [incentives, rules] = await Promise.all([api.listRentIncentives(property.id), api.listJurisdictionRules()]);
      const rentalReady = computeRentalReady(summary.verification);
      const quote = computePerfectRent({
        baseRentCents: property.rent * 100,
        incentives: incentives.filter((i) => i.enabled),
        jurisdictionAllowed: buildJurisdictionAllowed(rules, property.state),
        qualifies: {
          passport_verified: rentalReady.level === "rental_ready",
          rental_history: summary.verification.rentalHistory === "verified",
          auto_payment: autopayOn,
        },
        chosenLeaseMonths: property.lease_term_months,
      });
      setMonthlySavingsCents(quote.potentialMonthlySavingsCents);
      setEffectiveRentCents(quote.estimatedRentCents);
    })();
  }, [user, summary, property, autopayOn]);

  async function handleConfirm() {
    if (!user) return;
    setSaving(true);
    try {
      await api.setTenantPaymentSetup(user.id, { paymentMethodType: methodType, last4: String(1000 + Math.floor(Math.random() * 9000)), autopayDay });
      await api.setAutoPaymentEnrollment(user.id, autopayOn);
      if (autopayOn) {
        await api.notifyOnce(user.id, "autopay_enabled", "🟢 Perfect Pay Autopay is on — your rent will follow your chosen schedule.");
      }
      navigate("/perfect-pay");
    } finally {
      setSaving(false);
    }
  }

  const baseRentDollars = property ? property.rent : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <BackButton fallback="/perfect-pay" label="Exit setup" className="mb-4" />
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Perfect Pay™ setup</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">Set up automatic rent payments</h1>
      <p className="mt-2 text-sm text-slate-500">Step {step} of 5</p>

      <Card className="mt-4 p-6">
        {step === 1 && (
          <div>
            <h2 className="font-semibold text-ink-900">Choose a payment method</h2>
            <p className="mt-1 text-xs text-slate-500">
              Simulated in this preview — no real bank or card details are collected, stored, or charged.
            </p>
            <div className="mt-4 space-y-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${methodType === "bank" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
                <input type="radio" checked={methodType === "bank"} onChange={() => setMethodType("bank")} />
                <div>
                  <p className="text-sm font-medium text-ink-900">Bank account (ACH)</p>
                  <p className="text-xs text-emerald-700">Eligible for the Perfect Pay Autopay incentive, where offered</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${methodType === "card" ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
                <input type="radio" checked={methodType === "card"} onChange={() => setMethodType("card")} />
                <div>
                  <p className="text-sm font-medium text-ink-900">Debit card</p>
                  <p className="text-xs text-slate-500">May not qualify for every property's Autopay incentive</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-semibold text-ink-900">Choose your payment date</h2>
            <p className="mt-1 text-xs text-slate-500">Subject to your lease's actual due date and your landlord's settings.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {PAYMENT_DAYS.map((d) => (
                <label key={d} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${autopayDay === d ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}>
                  <input type="radio" checked={autopayDay === d} onChange={() => setAutopayDay(d)} />
                  {d === 1 ? "1st" : d === 3 ? "3rd" : d === 5 ? "5th" : "15th"} of the month
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-semibold text-ink-900">Turn on Perfect Pay Autopay</h2>
            <p className="mt-1 text-sm text-slate-600">Your rent will automatically be paid according to your lease/payment schedule.</p>
            <label className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 p-4">
              <span className="text-sm font-medium text-ink-900">Perfect Pay Autopay</span>
              <button
                type="button"
                onClick={() => setAutopayOn((v) => !v)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${autopayOn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}
              >
                {autopayOn ? "🟢 ON" : "OFF"}
              </button>
            </label>
            {!autopayOn && (
              <p className="mt-2 text-xs text-slate-500">
                You can still use Perfect Pay to track a manually-confirmed payment history — you just won't qualify for any
                Autopay-only incentive.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-semibold text-ink-900">Review</h2>
            {baseRentDollars === null ? (
              <p className="mt-2 text-sm text-slate-500">
                You don't have an approved rental yet — you can still finish setup now, and this will apply once you do.
              </p>
            ) : (
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Monthly rent</span>
                  <span>${baseRentDollars.toLocaleString()}/mo</span>
                </div>
                {monthlySavingsCents > 0 && (
                  <div className="flex justify-between text-brand-700">
                    <span>Eligible monthly incentive</span>
                    <span>-${(monthlySavingsCents / 100).toLocaleString()}/mo</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold text-ink-900">
                  <span>Potential effective monthly cost</span>
                  <span>${((effectiveRentCents ?? baseRentDollars * 100) / 100).toLocaleString()}/mo</span>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <p>Payment method: {methodType === "bank" ? "Bank account (ACH)" : "Debit card"}</p>
              <p>Payment date: day {autopayDay} of each month</p>
              <p>Autopay: {autopayOn ? "On" : "Off"}</p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <h2 className="mt-2 font-semibold text-ink-900">You're all set</h2>
            <p className="mt-1 text-sm text-slate-600">
              Perfect Pay {autopayOn ? "Autopay is on" : "is ready — turn on Autopay any time"}. Your landlord still confirms
              each payment once it's received, the same way Perfect Pay verification has always worked.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="secondary" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button disabled={saving} onClick={handleConfirm}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
