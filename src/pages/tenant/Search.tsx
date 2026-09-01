import { useEffect, useRef, useState, type ReactNode } from "react";
import * as api from "@/lib/data/api";
import type { PropertyFilter } from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { PropertyCard } from "@/components/tenant/PropertyCard";
import { PartnerOffersSidebar } from "@/components/tenant/PartnerOffersSidebar";
import { BackButton } from "@/components/ui/BackButton";
import { Input } from "@/components/ui/Field";
import type { PropertyType, PropertyWithPhotos } from "@/types/domain";

const PROPERTY_TYPES: PropertyType[] = ["apartment", "house", "condo", "townhouse", "studio"];
const RENT_PRESETS = [500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000, 5000];
const BEDS_OPTIONS = [1, 2, 3, 4];
const BATHS_OPTIONS = [1, 2, 3];

function formatRent(n: number) {
  return `$${n.toLocaleString()}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A pill button that opens a small popover below it. Position is computed
// from the button's actual on-screen rect (not CSS `absolute` relative to a
// narrow parent) and clamped to the viewport, so it can't run off-screen on
// a phone — the same fix used for the account menu dropdown.
function FilterBubble({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(300, window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      setStyle({ top: rect.bottom + 8, left, width });
    }
    setOpen((prev) => !prev);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
          active
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
        }`}
      >
        {label}
        <span className="text-[10px]">▾</span>
      </button>
      {open && style && (
        <div
          style={{ position: "fixed", top: style.top, left: style.left, width: style.width }}
          className="z-20 max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function TogglePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function ChipButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition ${
        selected ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );
}

function ApplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
    >
      Apply
    </button>
  );
}

export function TenantSearch() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PropertyFilter>({});
  const [perfectRentOnly, setPerfectRentOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cityInput, setCityInput] = useState("");

  async function load(currentFilter: PropertyFilter, perfectRentFilter: boolean) {
    setLoading(true);
    const [results, saved] = await Promise.all([
      api.listProperties(currentFilter),
      user ? api.listSavedProperties(user.id) : Promise.resolve([]),
    ]);
    let filtered = results;
    if (perfectRentFilter) {
      const withIncentives = await Promise.all(
        results.map(async (p) => ((await api.listRentIncentives(p.id)).some((i) => i.enabled) ? p : null)),
      );
      filtered = withIncentives.filter((p): p is PropertyWithPhotos => p !== null);
    }
    setProperties(filtered);
    setSavedIds(new Set(saved.map((p) => p.id)));
    setLoading(false);
  }

  useEffect(() => {
    load({}, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function toggleSave(propertyId: string) {
    if (!user) return;
    const nowSaved = await api.toggleSavedProperty(user.id, propertyId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(propertyId);
      else next.delete(propertyId);
      return next;
    });
  }

  function apply(next: PropertyFilter, perfectRent = perfectRentOnly) {
    setFilter(next);
    load(next, perfectRent);
  }

  function togglePerfectRent() {
    const next = !perfectRentOnly;
    setPerfectRentOnly(next);
    load(filter, next);
  }

  function togglePetFriendly() {
    apply({ ...filter, petFriendly: filter.petFriendly ? undefined : true });
  }

  function toggleType(type: PropertyType) {
    const current = filter.types ?? [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setFilter({ ...filter, types: next.length ? next : undefined });
  }

  function clearAll() {
    setCityInput("");
    setPerfectRentOnly(false);
    setFilter({});
    load({}, false);
  }

  const activeCount =
    (filter.minRent !== undefined || filter.maxRent !== undefined ? 1 : 0) +
    (filter.beds !== undefined ? 1 : 0) +
    (filter.baths !== undefined ? 1 : 0) +
    (filter.types?.length ? 1 : 0) +
    (filter.moveInBy ? 1 : 0) +
    (filter.petFriendly ? 1 : 0) +
    (perfectRentOnly ? 1 : 0);

  const priceLabel =
    filter.minRent !== undefined || filter.maxRent !== undefined
      ? `${filter.minRent !== undefined ? formatRent(filter.minRent) : "Any"} – ${filter.maxRent !== undefined ? formatRent(filter.maxRent) : "Any"}`
      : "Price";

  const bedsBathsLabel =
    filter.beds !== undefined || filter.baths !== undefined
      ? [filter.beds !== undefined ? `${filter.beds}+ bd` : null, filter.baths !== undefined ? `${filter.baths}+ ba` : null]
          .filter(Boolean)
          .join(" · ")
      : "Beds & Baths";

  const typeLabel = filter.types?.length ? filter.types.map(capitalize).join(", ") : "Home Type";
  const moveInLabel = filter.moveInBy ? `By ${filter.moveInBy}` : "Move-in Date";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <BackButton fallback="/home" className="mb-4" />
          <h1 className="text-2xl font-bold text-slate-900">Search listings</h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply({ ...filter, city: cityInput || undefined });
            }}
            className="mt-4 flex gap-2"
          >
            <Input
              placeholder="City (e.g. Omaha)"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="rounded-full"
            />
            <button
              type="submit"
              className="flex-none rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterBubble label={priceLabel} active={filter.minRent !== undefined || filter.maxRent !== undefined}>
              {(close) => (
                <div>
                  <p className="mb-2 font-semibold text-slate-900">Price range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Min</p>
                      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                        <ChipButton selected={filter.minRent === undefined} onClick={() => setFilter({ ...filter, minRent: undefined })}>
                          Any
                        </ChipButton>
                        {RENT_PRESETS.map((v) => (
                          <ChipButton key={v} selected={filter.minRent === v} onClick={() => setFilter({ ...filter, minRent: v })}>
                            {formatRent(v)}
                          </ChipButton>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Max</p>
                      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                        <ChipButton selected={filter.maxRent === undefined} onClick={() => setFilter({ ...filter, maxRent: undefined })}>
                          Any
                        </ChipButton>
                        {RENT_PRESETS.map((v) => (
                          <ChipButton key={v} selected={filter.maxRent === v} onClick={() => setFilter({ ...filter, maxRent: v })}>
                            {formatRent(v)}
                          </ChipButton>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ApplyButton
                    onClick={() => {
                      apply(filter);
                      close();
                    }}
                  />
                </div>
              )}
            </FilterBubble>

            <FilterBubble label={bedsBathsLabel} active={filter.beds !== undefined || filter.baths !== undefined}>
              {(close) => (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Bedrooms</p>
                  <div className="flex flex-wrap gap-1.5">
                    <ChipButton selected={filter.beds === undefined} onClick={() => setFilter({ ...filter, beds: undefined })}>
                      Any
                    </ChipButton>
                    {BEDS_OPTIONS.map((n) => (
                      <ChipButton key={n} selected={filter.beds === n} onClick={() => setFilter({ ...filter, beds: n })}>
                        {n}+
                      </ChipButton>
                    ))}
                  </div>
                  <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Bathrooms</p>
                  <div className="flex flex-wrap gap-1.5">
                    <ChipButton selected={filter.baths === undefined} onClick={() => setFilter({ ...filter, baths: undefined })}>
                      Any
                    </ChipButton>
                    {BATHS_OPTIONS.map((n) => (
                      <ChipButton key={n} selected={filter.baths === n} onClick={() => setFilter({ ...filter, baths: n })}>
                        {n}+
                      </ChipButton>
                    ))}
                  </div>
                  <ApplyButton
                    onClick={() => {
                      apply(filter);
                      close();
                    }}
                  />
                </div>
              )}
            </FilterBubble>

            <FilterBubble label={typeLabel} active={Boolean(filter.types?.length)}>
              {(close) => (
                <div>
                  <p className="mb-2 font-semibold text-slate-900">Home type</p>
                  <div className="space-y-1.5">
                    {PROPERTY_TYPES.map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={filter.types?.includes(t) ?? false} onChange={() => toggleType(t)} />
                        {capitalize(t)}
                      </label>
                    ))}
                  </div>
                  <ApplyButton
                    onClick={() => {
                      apply(filter);
                      close();
                    }}
                  />
                </div>
              )}
            </FilterBubble>

            <FilterBubble label={moveInLabel} active={Boolean(filter.moveInBy)}>
              {(close) => (
                <div>
                  <p className="mb-2 font-semibold text-slate-900">Move in by</p>
                  <Input
                    type="date"
                    value={filter.moveInBy ?? ""}
                    onChange={(e) => setFilter({ ...filter, moveInBy: e.target.value || undefined })}
                  />
                  <ApplyButton
                    onClick={() => {
                      apply(filter);
                      close();
                    }}
                  />
                </div>
              )}
            </FilterBubble>

            <TogglePill label="🐾 Pet Friendly" active={Boolean(filter.petFriendly)} onClick={togglePetFriendly} />
            <TogglePill label="Perfect Rent™ available" active={perfectRentOnly} onClick={togglePerfectRent} />

            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="text-sm font-medium text-slate-500 underline hover:text-slate-700">
                Clear all
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {!loading && (
              <p className="text-sm text-slate-500">
                {properties.length} listing{properties.length === 1 ? "" : "s"} found
              </p>
            )}
            {loading && <p className="text-sm text-slate-500">Loading…</p>}
            {!loading && properties.length === 0 && <p className="text-sm text-slate-500">No listings match those filters.</p>}
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} saved={savedIds.has(p.id)} onToggleSave={user ? () => toggleSave(p.id) : undefined} />
            ))}
          </div>
        </div>

        <PartnerOffersSidebar placement="search_sidebar" />
      </div>
    </div>
  );
}
