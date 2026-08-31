import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormRow, Input, Select } from "@/components/ui/Field";
import type { PassportVisibility, PropertyType, TenantSummary } from "@/types/domain";

const PROPERTY_TYPES: PropertyType[] = ["apartment", "house", "condo", "townhouse", "studio"];
const VISIBILITY_OPTIONS: { value: PassportVisibility; label: string }[] = [
  { value: "marketplace", label: "Landlords in the Tenant Marketplace (recommended)" },
  { value: "applied_or_saved_only", label: "Only landlords I apply to or who save me" },
  { value: "private", label: "No one — I'll share my Passport manually" },
];

export function TenantOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [saving, setSaving] = useState(false);

  const [introText, setIntroText] = useState("");
  const [householdSize, setHouseholdSize] = useState(1);
  const [minRent, setMinRent] = useState(1000);
  const [maxRent, setMaxRent] = useState(2000);
  const [beds, setBeds] = useState(1);
  const [baths, setBaths] = useState(1);
  const [moveInDate, setMoveInDate] = useState("");
  const [pets, setPets] = useState(false);
  const [parkingRequired, setParkingRequired] = useState(false);
  const [desiredAmenities, setDesiredAmenities] = useState("");
  const [leasePrefMonths, setLeasePrefMonths] = useState(12);
  const [visibility, setVisibility] = useState<PassportVisibility>("marketplace");
  const [types, setTypes] = useState<PropertyType[]>(["apartment"]);
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(10);

  useEffect(() => {
    if (!user) return;
    api.getTenantSummary(user.id).then((s) => {
      if (!s) return;
      setSummary(s);
      setIntroText(s.tenant.intro_text ?? "");
      setHouseholdSize(s.tenant.household_size);
      setMinRent(s.preferences.min_rent);
      setMaxRent(s.preferences.max_rent);
      setBeds(s.preferences.beds);
      setBaths(s.preferences.baths);
      setMoveInDate(s.preferences.move_in_date);
      setPets(s.preferences.pets);
      setParkingRequired(s.preferences.parking_required);
      setDesiredAmenities(s.preferences.desired_amenities.join(", "));
      setLeasePrefMonths(s.tenant.lease_pref_months ?? 12);
      setVisibility(s.tenant.passport_visibility);
      setTypes(s.preferences.property_types);
      if (s.areas[0]) {
        setCity(s.areas[0].city);
        setZip(s.areas[0].zip);
        setRadius(s.areas[0].radius_miles);
      }
    });
  }, [user]);

  function toggleType(t: PropertyType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await api.updateTenantProfile(user.id, {
        intro_text: introText,
        household_size: householdSize,
        lease_pref_months: leasePrefMonths,
        passport_visibility: visibility,
      });
      await api.updateTenantPreferences(user.id, {
        min_rent: minRent,
        max_rent: maxRent,
        beds,
        baths,
        move_in_date: moveInDate,
        pets,
        parking_required: parkingRequired,
        desired_amenities: desiredAmenities.split(",").map((a) => a.trim()).filter(Boolean),
        property_types: types,
      });
      if (city && zip) {
        if (summary?.areas[0]) {
          await api.removeTenantArea(summary.areas[0].id);
        }
        await api.addTenantArea({ tenant_id: user.id, city, zip, lat: 41.25, lng: -95.94, radius_miles: radius });
      }
      navigate("/matches");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Tell us what you're looking for</h1>
      <p className="mt-1 text-sm text-slate-600">
        This powers your match score and what landlords see about you.
      </p>

      <Card className="mt-6 space-y-6 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <FormRow label="About you">
            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="A short intro landlords will see on your profile."
            />
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Household size">
              <Input type="number" min={1} value={householdSize} onChange={(e) => setHouseholdSize(Number(e.target.value))} />
            </FormRow>
            <FormRow label="Move-in date">
              <Input type="date" required value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Min rent ($/mo)">
              <Input type="number" min={0} value={minRent} onChange={(e) => setMinRent(Number(e.target.value))} />
            </FormRow>
            <FormRow label="Max rent ($/mo)">
              <Input type="number" min={0} value={maxRent} onChange={(e) => setMaxRent(Number(e.target.value))} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Min beds">
              <Input type="number" min={0} value={beds} onChange={(e) => setBeds(Number(e.target.value))} />
            </FormRow>
            <FormRow label="Min baths">
              <Input type="number" min={0} value={baths} onChange={(e) => setBaths(Number(e.target.value))} />
            </FormRow>
          </div>

          <FormRow label="Property types">
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${
                    types.includes(t) ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </FormRow>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Have pets?">
              <Select value={pets ? "yes" : "no"} onChange={(e) => setPets(e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </FormRow>
            <FormRow label="Need parking?">
              <Select value={parkingRequired ? "yes" : "no"} onChange={(e) => setParkingRequired(e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Desired amenities (comma separated)">
              <Input value={desiredAmenities} onChange={(e) => setDesiredAmenities(e.target.value)} placeholder="e.g. in-unit laundry, gym" />
            </FormRow>
            <FormRow label="Lease length preference (months)">
              <Input type="number" min={1} value={leasePrefMonths} onChange={(e) => setLeasePrefMonths(Number(e.target.value))} />
            </FormRow>
          </div>

          <FormRow label="Who can see my Perfect10ant Passport?">
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value as PassportVisibility)}>
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormRow>

          <div className="grid grid-cols-3 gap-4">
            <FormRow label="City">
              <Input required value={city} onChange={(e) => setCity(e.target.value)} />
            </FormRow>
            <FormRow label="Zip">
              <Input required value={zip} onChange={(e) => setZip(e.target.value)} />
            </FormRow>
            <FormRow label="Radius (mi)">
              <Input type="number" min={1} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </FormRow>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save & see my matches"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
