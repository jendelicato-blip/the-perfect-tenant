import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormRow, Input, Select } from "@/components/ui/Field";
import type { Property, PropertyStatus, PropertyType } from "@/types/domain";

type PetPolicyOption = Property["pet_policy"];

const PROPERTY_TYPES: PropertyType[] = ["apartment", "house", "condo", "townhouse", "studio"];
const PET_POLICIES: PetPolicyOption[] = ["no_pets", "cats_only", "dogs_only", "cats_and_dogs", "case_by_case"];
const STATUSES: PropertyStatus[] = ["draft", "active", "paused", "leased"];

const emptyForm = {
  address: "",
  city: "",
  state: "",
  zip: "",
  lat: 41.25,
  lng: -95.94,
  rent: 1500,
  deposit: 1500,
  beds: 1,
  baths: 1,
  sqft: 0,
  type: "apartment" as PropertyType,
  available_date: new Date().toISOString().slice(0, 10),
  pet_policy: "no_pets" as PetPolicyOption,
  amenities: "",
  description: "",
  status: "active" as PropertyStatus,
  photoUrl: "",
};

export function LandlordPropertyForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getProperty(id).then((p) => {
      if (!p) return;
      setForm({
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        lat: p.lat,
        lng: p.lng,
        rent: p.rent,
        deposit: p.deposit,
        beds: p.beds,
        baths: p.baths,
        sqft: p.sqft ?? 0,
        type: p.type,
        available_date: p.available_date,
        pet_policy: p.pet_policy,
        amenities: p.amenities.join(", "),
        description: p.description,
        status: p.status,
        photoUrl: p.photos[0]?.url ?? "",
      });
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const amenities = form.amenities.split(",").map((a) => a.trim()).filter(Boolean);
      if (isEditing && id) {
        await api.updateProperty(id, { ...form, sqft: form.sqft || null, amenities });
      } else {
        const property = await api.createProperty({
          landlord_id: user.id,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          lat: form.lat,
          lng: form.lng,
          rent: form.rent,
          deposit: form.deposit,
          beds: form.beds,
          baths: form.baths,
          sqft: form.sqft || null,
          type: form.type,
          available_date: form.available_date,
          pet_policy: form.pet_policy,
          amenities,
          description: form.description,
          status: form.status,
        });
        if (form.photoUrl) await api.addPropertyPhoto(property.id, form.photoUrl);
      }
      navigate("/landlord");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{isEditing ? "Edit listing" : "New listing"}</h1>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormRow label="Address">
            <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-3 gap-4">
            <FormRow label="City">
              <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </FormRow>
            <FormRow label="State">
              <Input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </FormRow>
            <FormRow label="Zip">
              <Input required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Rent ($/mo)">
              <Input type="number" min={0} required value={form.rent} onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })} />
            </FormRow>
            <FormRow label="Deposit ($)">
              <Input type="number" min={0} required value={form.deposit} onChange={(e) => setForm({ ...form, deposit: Number(e.target.value) })} />
            </FormRow>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormRow label="Beds">
              <Input type="number" min={0} required value={form.beds} onChange={(e) => setForm({ ...form, beds: Number(e.target.value) })} />
            </FormRow>
            <FormRow label="Baths">
              <Input type="number" min={0} required value={form.baths} onChange={(e) => setForm({ ...form, baths: Number(e.target.value) })} />
            </FormRow>
            <FormRow label="Sqft">
              <Input type="number" min={0} value={form.sqft} onChange={(e) => setForm({ ...form, sqft: Number(e.target.value) })} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Property type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PropertyType })}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Available date">
              <Input type="date" required value={form.available_date} onChange={(e) => setForm({ ...form, available_date: e.target.value })} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Pet policy">
              <Select value={form.pet_policy} onChange={(e) => setForm({ ...form, pet_policy: e.target.value as PetPolicyOption })}>
                {PET_POLICIES.map((p) => (
                  <option key={p} value={p}>
                    {p.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PropertyStatus })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormRow>
          </div>

          <FormRow label="Amenities (comma separated)">
            <Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
          </FormRow>

          <FormRow label="Photo URL">
            <Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} />
          </FormRow>

          <FormRow label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </FormRow>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : isEditing ? "Save changes" : "Create listing"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
