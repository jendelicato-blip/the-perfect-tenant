import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  computeMonthlyCollectionReport,
  groupPayoutPeriods,
  payoutHistoryToCsv,
  reconciliationReportToCsv,
  type MonthlyCollectionReport,
  type PayoutPeriod,
} from "@/lib/perfectPay/reconciliation";
import type { Application, PaymentRefund, PaymentVerification, PlatformFeeConfig, PropertyWithPhotos, RentIncentive } from "@/types/domain";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  return new Date(`${month}-01`).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function LandlordPayouts() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [payments, setPayments] = useState<PaymentVerification[]>([]);
  const [refunds, setRefunds] = useState<PaymentRefund[]>([]);
  const [incentivesByProperty, setIncentivesByProperty] = useState<Map<string, RentIncentive[]>>(new Map());
  const [feeConfig, setFeeConfig] = useState<PlatformFeeConfig | null>(null);
  const [autopayEnrolled, setAutopayEnrolled] = useState(0);
  const [autopayTotal, setAutopayTotal] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [props, apps, pays, refs, fee, autopay] = await Promise.all([
        api.listPropertiesForLandlord(user.id),
        api.listApplicationsForLandlord(user.id),
        api.listPaymentVerificationsForLandlord(user.id),
        api.listRefundsForLandlord(user.id),
        api.getPlatformFeeConfig(),
        api.listLandlordTenantAutopayStatus(user.id),
      ]);
      setProperties(props);
      setApplications(apps);
      setPayments(pays);
      setRefunds(refs);
      setFeeConfig(fee);
      setAutopayEnrolled(autopay.filter((a) => a.autoPaymentEnrolled).length);
      setAutopayTotal(autopay.length);

      const incentiveMap = new Map<string, RentIncentive[]>();
      await Promise.all(
        props.map(async (p) => {
          incentiveMap.set(p.id, await api.listRentIncentives(p.id));
        }),
      );
      setIncentivesByProperty(incentiveMap);
      setLoading(false);
    })();
  }, [user]);

  if (loading || !user || !feeConfig) return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const propertiesById = new Map(properties.map((p) => [p.id, p]));
  const occupiedPropertyIds = new Set(applications.filter((a) => a.status === "approved").map((a) => a.property_id));
  const occupiedProperties = properties.filter((p) => occupiedPropertyIds.has(p.id));

  const payoutPeriods: PayoutPeriod[] = groupPayoutPeriods(payments, propertiesById, feeConfig, user.id, refunds);

  const paymentsThisMonth = payments.filter((p) => p.period_start.startsWith(selectedMonth));
  const paymentIdsThisMonth = new Set(paymentsThisMonth.map((p) => p.id));
  const refundsThisMonth = refunds.filter((r) => paymentIdsThisMonth.has(r.payment_verification_id));
  const report: MonthlyCollectionReport = computeMonthlyCollectionReport({
    month: selectedMonth,
    occupiedProperties,
    paymentsThisMonth,
    incentivesByProperty,
    autopayEnrolledCount: autopayEnrolled,
    autopayTotalCount: autopayTotal,
    feeConfig,
    refundsThisMonth,
  });

  const months = [...new Set(payments.map((p) => p.period_start.slice(0, 7)))].sort().reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <BackButton fallback="/landlord" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Payouts &amp; Reconciliation</h1>
      <p className="mt-1 text-sm text-slate-500">
        Reflects rent payments you've confirmed — not a real bank transfer or settlement record (see Perfect Pay™ settings).
      </p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Monthly Collection Report</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() => downloadCsv(`perfect-pay-reconciliation-${selectedMonth}.csv`, reconciliationReportToCsv(report))}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="mt-3 p-5">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Rent scheduled</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.rentScheduledCents / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Rent collected</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.rentCollectedCents / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Outstanding</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.outstandingCents / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Failed / disputed payments</p>
            <p className="mt-1 font-semibold text-ink-900">{report.failedPaymentsCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">On-time rate</p>
            <p className="mt-1 font-semibold text-ink-900">{report.onTimeRatePercent === null ? "—" : `${report.onTimeRatePercent}%`}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Tenant autopay rate</p>
            <p className="mt-1 font-semibold text-ink-900">{report.autopayRatePercent === null ? "—" : `${report.autopayRatePercent}%`}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Landlord-funded incentives</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.landlordFundedIncentiveCents / 100).toLocaleString()}/mo</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Perfect10ant-funded incentives</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.platformFundedIncentiveCents / 100).toLocaleString()}/mo</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Platform fee</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.feeCents / 100).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Refunds issued</p>
            <p className="mt-1 font-semibold text-ink-900">${(report.refundedCents / 100).toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-ink-900">
          <span>Net payout</span>
          <span>${(report.netPayoutCents / 100).toLocaleString()}</span>
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Payout History</h2>
        {payoutPeriods.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => downloadCsv(`perfect-pay-payouts-${user.id.slice(0, 8)}.csv`, payoutHistoryToCsv(payoutPeriods))}
          >
            Export CSV
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {payoutPeriods.length === 0 && <p className="text-sm text-slate-500">No confirmed payments yet.</p>}
        {payoutPeriods.map((period) => (
          <Card key={period.month} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium text-slate-900">{formatMonth(period.month)}</p>
              <p className="text-xs text-slate-400">{period.reference}</p>
            </div>
            <div className="text-slate-600">
              {period.propertiesCount} propert{period.propertiesCount === 1 ? "y" : "ies"} · {period.paymentsCount} payment
              {period.paymentsCount === 1 ? "" : "s"}
            </div>
            <div className="text-slate-600">Fee: ${(period.feeCents / 100).toFixed(2)}</div>
            {period.refundedCents > 0 && <div className="text-red-600">Refunded: ${(period.refundedCents / 100).toFixed(2)}</div>}
            <div className="font-semibold text-ink-900">${(period.netCents / 100).toLocaleString()}</div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">✓ Reflects confirmed rent</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
