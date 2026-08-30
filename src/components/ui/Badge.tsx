import type { RentalReadyLevel, VerificationStatus } from "@/types/domain";

const STATUS_STYLES: Record<VerificationStatus, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  not_started: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-800",
  expired: "bg-slate-200 text-slate-600",
};

const STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  not_started: "Not started",
  failed: "Failed",
  expired: "Expired",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" | "success" | "warning" }) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    brand: "bg-brand-100 text-brand-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

const RENTAL_READY_STYLES: Record<RentalReadyLevel, string> = {
  rental_ready: "bg-emerald-100 text-emerald-800",
  almost_ready: "bg-amber-100 text-amber-800",
  action_required: "bg-red-100 text-red-800",
};

const RENTAL_READY_LABELS: Record<RentalReadyLevel, string> = {
  rental_ready: "🟢 RENTAL READY",
  almost_ready: "🟡 ALMOST READY",
  action_required: "🔴 ACTION REQUIRED",
};

export function RentalReadyBadge({ level, className = "" }: { level: RentalReadyLevel; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${RENTAL_READY_STYLES[level]} ${className}`}>
      {RENTAL_READY_LABELS[level]}
    </span>
  );
}
