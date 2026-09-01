import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { RentalReadyBadge } from "@/components/ui/Badge";
import { computeRentalReady, isVerifiedLandlord, type Landlord, type TenantSummary } from "@/types/domain";

// There's no separate "name" field anywhere in the schema (tenants/landlords
// only ever collect an email) — this derives a display name from the
// account's real email local-part (e.g. "amara.tenant@example.com" ->
// "Amara") rather than inventing one. It's a best-effort label, not a
// substitute for actually collecting a name.
function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const first = local.split(/[._-]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// A compact circular avatar (initial only) that opens a small profile
// panel — real email, role, and (tenant) Rental Ready / (landlord) Verified
// Landlord status, both computed the same way the rest of the app does.
// Replaces showing the full email address inline in the header.
export function AccountMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tenantSummary, setTenantSummary] = useState<TenantSummary | null>(null);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "tenant") api.getTenantSummary(user.id).then(setTenantSummary);
    else api.getLandlordProfile(user.id).then((l) => setLandlord(l as Landlord | null));
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const name = displayNameFromEmail(user.email);
  const initial = name.charAt(0).toUpperCase();

  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(288, window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      setPanelStyle({ top: rect.bottom + 8, left, width });
    }
    setOpen((prev) => !prev);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700"
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open && panelStyle && (
        <div
          style={{ position: "fixed", top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          className="z-20 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="font-semibold text-ink-900">{name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {user.role}
            {user.is_admin ? " · Admin" : ""}
          </p>

          {user.role === "tenant" && tenantSummary && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Passport status</p>
              <RentalReadyBadge level={computeRentalReady(tenantSummary.verification).level} className="mt-1.5" />
              <Link to="/passport" className="mt-2 block text-xs font-medium text-brand-700 hover:underline">
                View My Passport →
              </Link>
              <Link to="/verified" className="mt-1.5 block text-xs font-medium text-brand-700 hover:underline">
                Get Perfect10ant Verified™ →
              </Link>
              <Link to="/plus" className="mt-1.5 block text-xs font-medium text-brand-700 hover:underline">
                Perfect10ant Plus™ →
              </Link>
            </div>
          )}

          {user.role === "landlord" && landlord && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Verification</p>
              <p className="mt-1.5 text-sm font-medium text-ink-900">
                {isVerifiedLandlord(landlord) ? "✓ Verified Landlord" : "Not yet verified"}
              </p>
              {landlord.company_name && <p className="mt-0.5 text-xs text-slate-500">{landlord.company_name}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
