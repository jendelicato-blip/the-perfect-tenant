import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PartnerOfferCard } from "@/components/tenant/PartnerOfferCard";
import { selectPartnerOffers } from "@/lib/perfectPartners/engine";
import type { PartnerOffer, PerfectPartner } from "@/types/domain";

// Desktop-only, narrow sidebar — the "useful, relevant, never overwhelming"
// placement described in the build plan. Card count is capped by
// selectPartnerOffers()/ad_frequency_rules, not a hard-coded number.
export function PartnerOffersSidebar({ placement }: { placement: string }) {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PerfectPartner[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);

  useEffect(() => {
    Promise.all([api.listPerfectPartners(), api.listPartnerOffers(), api.getAdFrequencyRules()]).then(([p, o, rules]) => {
      setPartners(p);
      setOffers(selectPartnerOffers(o, rules));
    });
  }, []);

  if (offers.length === 0) return null;
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  return (
    <aside className="hidden w-64 flex-none space-y-3 lg:block">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Perfect Partners™</p>
      {offers.map((offer) => {
        const partner = partnerById.get(offer.partner_id);
        if (!partner) return null;
        return <PartnerOfferCard key={offer.id} partner={partner} offer={offer} tenantId={user?.id} placement={placement} />;
      })}
      <Link to="/partners" className="block text-xs font-medium text-brand-600 hover:underline">
        See all Perfect Partners →
      </Link>
    </aside>
  );
}
