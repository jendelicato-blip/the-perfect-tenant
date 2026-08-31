import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { Card } from "@/components/ui/Card";
import type { PartnerOffer, PerfectPartner } from "@/types/domain";

// A small, professional card — never a pop-up, never disguised as an
// organic recommendation or system notification. "Sponsored" is always
// visible before the offer text, and the promo code/next step only appears
// after the tenant actively asks for it ("Get Offer"), never before.
export function PartnerOfferCard({
  partner,
  offer,
  tenantId,
  placement,
}: {
  partner: PerfectPartner;
  offer: PartnerOffer;
  tenantId?: string;
  placement: string;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void api.recordAdImpression("offer", offer.id, placement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.id]);

  async function handleGetOffer() {
    if (tenantId) await api.redeemPartnerOffer(tenantId, offer.id);
    else await api.recordAdClick("offer", offer.id, placement);
    setRevealed(true);
  }

  return (
    <Card className="p-4">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sponsored</span>
      <p className="mt-1 text-sm font-semibold text-ink-900">
        {partner.emoji} {offer.title}
      </p>
      <p className="text-xs text-slate-400">{partner.name}</p>
      <p className="mt-1 text-xs text-slate-500">{offer.description}</p>
      <p className="mt-1 text-sm font-medium text-brand-700">{offer.offer_text}</p>
      {revealed ? (
        <p className="mt-2 rounded bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
          {offer.promo_code ? `Use code ${offer.promo_code}` : "Offer unlocked — a partner representative will follow up."}
        </p>
      ) : (
        <button onClick={handleGetOffer} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
          {offer.cta_label} →
        </button>
      )}
    </Card>
  );
}
