import { InlineLogo } from "@/components/Logo";
import { BackButton } from "@/components/ui/BackButton";

export function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <BackButton fallback="/" className="mb-4" />
      <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
        About us
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-ink-900">The Verified Rental Network</h1>
      <p className="mt-4 text-slate-600">
        Apartments.com helps you find a property. <InlineLogo className="h-5 w-auto" /> helps you
        become a verified renter — one Passport, reusable across every property you apply to.
        Landlords get verified rental prospects instead of a stack of applications to sort through
        by hand.
      </p>
      <p className="mt-4 text-slate-600">
        More trust. Less guesswork. Better rentals — for tenants and landlords alike.
      </p>
    </div>
  );
}
