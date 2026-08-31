import { useEffect, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Card } from "@/components/ui/Card";
import { PartnerOfferCard } from "@/components/tenant/PartnerOfferCard";
import { AD_CATEGORY_LABELS, type AdCategory, type PartnerOffer, type PerfectPartner } from "@/types/domain";

const CATEGORY_ORDER = Object.keys(AD_CATEGORY_LABELS) as AdCategory[];

export function Partners() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PerfectPartner[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listPerfectPartners(), api.listPartnerOffers()]).then(([p, o]) => {
      setPartners(p);
      setOffers(o);
      setLoading(false);
    });
  }, []);

  const offersByPartner = new Map<string, PartnerOffer[]>();
  for (const o of offers) {
    (offersByPartner.get(o.partner_id) ?? offersByPartner.set(o.partner_id, []).get(o.partner_id)!).push(o);
  }
  const partnersByCategory = new Map<AdCategory, PerfectPartner[]>();
  for (const p of partners) {
    (partnersByCategory.get(p.category) ?? partnersByCategory.set(p.category, []).get(p.category)!).push(p);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-serif text-2xl font-semibold text-ink-900">Perfect Partners™</h1>
      <p className="mt-1 text-sm text-slate-600">Helpful services for your next move.</p>

      <Card className="mt-6 p-5">
        <h2 className="font-serif text-base font-semibold text-ink-900">Our Advertising Promise</h2>
        <p className="mt-2 text-sm text-slate-600">
          The Perfect10ant believes advertising should be useful, relevant, and transparent.
          Sponsored businesses and offers are always clearly labeled. Paying for advertising never
          changes verification results, Perfect Match™ scores, or any objective rental information.
        </p>
      </Card>

      <h2 className="mt-8 font-serif text-lg font-semibold text-ink-900">Make Your New Place Home</h2>
      <p className="text-sm text-slate-600">Everything for your move, in one place.</p>

      {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {!loading &&
        CATEGORY_ORDER.map((category) => {
          const categoryPartners = partnersByCategory.get(category) ?? [];
          if (categoryPartners.length === 0) return null;
          return (
            <div key={category} className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{AD_CATEGORY_LABELS[category]}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {categoryPartners.flatMap((partner) =>
                  (offersByPartner.get(partner.id) ?? []).map((offer) => (
                    <PartnerOfferCard key={offer.id} partner={partner} offer={offer} tenantId={user?.id} placement="partners_page" />
                  )),
                )}
              </div>
            </div>
          );
        })}

      {!loading && partners.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No Perfect Partners are live yet — check back soon.</p>
      )}
    </div>
  );
}
