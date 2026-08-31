import type { PaymentVerification, PlatformFeeConfig, PropertyWithPhotos, RentIncentive } from "@/types/domain";

// Payout history + reconciliation reporting. Everything here is computed
// from real rows a landlord already legitimately has full access to
// (payment_verifications they themselves confirmed, their own properties'
// rent_incentives, the current platform_fee_config) — nothing here
// fabricates a transaction or claims money actually moved. See the
// migration comment on landlord_visible_autopay and the domain.ts note on
// LandlordPayoutAccount for the same honesty boundary applied elsewhere in
// Perfect Pay™.
//
// A deliberate simplification: payment_verifications only ever records one
// row per calendar month of rent (see recordPayment), so "payout periods"
// here always group by month regardless of the landlord's configured
// payout_schedule (daily/weekly/monthly) — that setting describes how a
// real integration would time disbursements, not something this monthly
// rent-confirmation data can be split into without inventing sub-monthly
// structure that isn't there.

export interface FeeBreakdown {
  feeCents: number;
  landlordPaysFee: boolean;
}

export function computeFee(grossCents: number, config: Pick<PlatformFeeConfig, "percent_fee" | "flat_fee_cents" | "fee_payer">): FeeBreakdown {
  const feeCents = Math.round((grossCents * config.percent_fee) / 100) + config.flat_fee_cents;
  return { feeCents, landlordPaysFee: config.fee_payer === "landlord" };
}

export interface PayoutPeriod {
  month: string; // YYYY-MM
  payoutDate: string; // ISO date — latest verified_at in the period, as a proxy for when this would have disbursed
  grossCents: number;
  propertiesCount: number;
  paymentsCount: number;
  feeCents: number;
  netCents: number;
  reference: string;
}

export function groupPayoutPeriods(
  payments: PaymentVerification[],
  propertiesById: Map<string, PropertyWithPhotos>,
  feeConfig: Pick<PlatformFeeConfig, "percent_fee" | "flat_fee_cents" | "fee_payer">,
  landlordId: string,
): PayoutPeriod[] {
  const confirmed = payments.filter((p) => p.status === "on_time" || p.status === "late");
  const byMonth = new Map<string, PaymentVerification[]>();
  for (const p of confirmed) {
    const month = p.period_start.slice(0, 7);
    (byMonth.get(month) ?? byMonth.set(month, []).get(month)!).push(p);
  }

  return [...byMonth.entries()]
    .map(([month, monthPayments]) => {
      const grossCents = monthPayments.reduce((sum, p) => sum + (propertiesById.get(p.property_id)?.rent ?? 0) * 100, 0);
      const { feeCents, landlordPaysFee } = computeFee(grossCents, feeConfig);
      const latestVerifiedAt = monthPayments.reduce((latest, p) => (p.verified_at > latest ? p.verified_at : latest), monthPayments[0].verified_at);
      return {
        month,
        payoutDate: latestVerifiedAt,
        grossCents,
        propertiesCount: new Set(monthPayments.map((p) => p.property_id)).size,
        paymentsCount: monthPayments.length,
        feeCents,
        netCents: grossCents - (landlordPaysFee ? feeCents : 0),
        reference: `P10-PO-${month.replace("-", "")}-${landlordId.slice(0, 8).toUpperCase()}`,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

export interface MonthlyCollectionReport {
  month: string;
  rentScheduledCents: number;
  rentCollectedCents: number;
  outstandingCents: number;
  failedPaymentsCount: number;
  autopayRatePercent: number | null;
  onTimeRatePercent: number | null;
  landlordFundedIncentiveCents: number;
  platformFundedIncentiveCents: number;
  feeCents: number;
  netPayoutCents: number;
}

export function computeMonthlyCollectionReport(input: {
  month: string;
  occupiedProperties: PropertyWithPhotos[];
  paymentsThisMonth: PaymentVerification[];
  incentivesByProperty: Map<string, RentIncentive[]>;
  autopayEnrolledCount: number;
  autopayTotalCount: number;
  feeConfig: Pick<PlatformFeeConfig, "percent_fee" | "flat_fee_cents" | "fee_payer">;
}): MonthlyCollectionReport {
  const rentScheduledCents = input.occupiedProperties.reduce((sum, p) => sum + p.rent * 100, 0);
  const confirmed = input.paymentsThisMonth.filter((p) => p.status === "on_time" || p.status === "late");
  const rentCollectedCents = confirmed.reduce((sum, p) => {
    const property = input.occupiedProperties.find((prop) => prop.id === p.property_id);
    return sum + (property ? property.rent * 100 : 0);
  }, 0);
  const failedPaymentsCount = input.paymentsThisMonth.filter((p) => p.status === "disputed").length;
  const onTimeCount = input.paymentsThisMonth.filter((p) => p.status === "on_time").length;
  const decidedCount = input.paymentsThisMonth.length;

  let landlordFundedIncentiveCents = 0;
  let platformFundedIncentiveCents = 0;
  for (const property of input.occupiedProperties) {
    for (const incentive of input.incentivesByProperty.get(property.id) ?? []) {
      if (!incentive.enabled) continue;
      if (incentive.funded_by === "landlord") landlordFundedIncentiveCents += incentive.discount_cents;
      else platformFundedIncentiveCents += incentive.discount_cents;
    }
  }

  const { feeCents, landlordPaysFee } = computeFee(rentCollectedCents, input.feeConfig);

  return {
    month: input.month,
    rentScheduledCents,
    rentCollectedCents,
    outstandingCents: Math.max(0, rentScheduledCents - rentCollectedCents),
    failedPaymentsCount,
    autopayRatePercent: input.autopayTotalCount > 0 ? Math.round((input.autopayEnrolledCount / input.autopayTotalCount) * 100) : null,
    onTimeRatePercent: decidedCount > 0 ? Math.round((onTimeCount / decidedCount) * 100) : null,
    landlordFundedIncentiveCents,
    platformFundedIncentiveCents,
    feeCents,
    netPayoutCents: rentCollectedCents - (landlordPaysFee ? feeCents : 0),
  };
}

export function payoutHistoryToCsv(periods: PayoutPeriod[]): string {
  const header = ["Month", "Payout Date", "Gross Amount", "Properties", "Payments", "Fee", "Net Payout", "Reference"];
  const rows = periods.map((p) => [
    p.month,
    p.payoutDate.slice(0, 10),
    (p.grossCents / 100).toFixed(2),
    String(p.propertiesCount),
    String(p.paymentsCount),
    (p.feeCents / 100).toFixed(2),
    (p.netCents / 100).toFixed(2),
    p.reference,
  ]);
  return [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function reconciliationReportToCsv(report: MonthlyCollectionReport): string {
  const rows: [string, string][] = [
    ["Month", report.month],
    ["Rent scheduled", (report.rentScheduledCents / 100).toFixed(2)],
    ["Rent collected", (report.rentCollectedCents / 100).toFixed(2)],
    ["Outstanding", (report.outstandingCents / 100).toFixed(2)],
    ["Failed / disputed payments", String(report.failedPaymentsCount)],
    ["On-time rate (%)", report.onTimeRatePercent === null ? "" : String(report.onTimeRatePercent)],
    ["Tenant autopay rate (%)", report.autopayRatePercent === null ? "" : String(report.autopayRatePercent)],
    ["Landlord-funded incentives (monthly)", (report.landlordFundedIncentiveCents / 100).toFixed(2)],
    ["Perfect10ant-funded incentives (monthly)", (report.platformFundedIncentiveCents / 100).toFixed(2)],
    ["Platform fee", (report.feeCents / 100).toFixed(2)],
    ["Net payout", (report.netPayoutCents / 100).toFixed(2)],
  ];
  return rows.map(([label, value]) => `"${label.replace(/"/g, '""')}","${value.replace(/"/g, '""')}"`).join("\n");
}
