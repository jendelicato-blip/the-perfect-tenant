import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Application, PaymentVerification, PropertyWithPhotos } from "@/types/domain";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function LandlordDashboard() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<PropertyWithPhotos[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [payments, setPayments] = useState<PaymentVerification[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listPropertiesForLandlord(user.id).then(setProperties);
    api.listApplicationsForLandlord(user.id).then(setApplications);
    api.listPaymentVerificationsForLandlord(user.id).then(setPayments);
  }, [user]);

  const occupiedPropertyIds = new Set(applications.filter((a) => a.status === "approved").map((a) => a.property_id));
  const occupiedProperties = properties.filter((p) => occupiedPropertyIds.has(p.id));
  const vacantCount = properties.filter((p) => p.status === "active" && !occupiedPropertyIds.has(p.id)).length;
  const scheduledRent = occupiedProperties.reduce((sum, p) => sum + p.rent, 0);
  const month = currentMonth();
  const paidThisMonth = payments.filter((p) => p.period_start.startsWith(month) && p.status === "on_time");
  const collectedRent = occupiedProperties
    .filter((p) => paidThisMonth.some((pay) => pay.property_id === p.id))
    .reduce((sum, p) => sum + p.rent, 0);
  const pendingRent = Math.max(0, scheduledRent - collectedRent);
  const pctCollected = scheduledRent > 0 ? Math.round((collectedRent / scheduledRent) * 100) : 0;

  async function handleDelete(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    await api.deleteProperty(id);
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Manage Your Rentals</h1>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Properties</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{properties.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Occupied</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{occupiedProperties.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Vacant</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{vacantCount}</p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Perfect Pay™ — {new Date(`${month}-01`).toLocaleDateString(undefined, { month: "long" })} Rent</h2>
          <p className="text-sm font-semibold text-brand-700">{pctCollected}% Collected</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          ${collectedRent.toLocaleString()} / ${scheduledRent.toLocaleString()} collected
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-brand-500" style={{ width: `${pctCollected}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Outstanding: ${pendingRent.toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link to="/landlord/rent-collection">
            <Button variant="secondary">View Rent Collection</Button>
          </Link>
          <Link to="/landlord/perfect-pay-settings">
            <Button variant="secondary">Perfect Pay Settings</Button>
          </Link>
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Your listings</h2>
        <Link to="/landlord/properties/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {properties.length === 0 && <p className="text-sm text-slate-500">No listings yet — create your first one.</p>}
        {properties.map((p) => {
          const count = applications.filter((a) => a.property_id === p.id).length;
          return (
            <Card key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-16 w-24 flex-none overflow-hidden rounded-lg bg-slate-100">
                {p.photos[0] && <img src={p.photos[0].url} alt={p.address} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{p.address}</p>
                <p className="text-sm text-slate-500">
                  {p.city}, {p.state} · ${p.rent}/mo · {p.beds} bd / {p.baths} ba
                </p>
              </div>
              <Badge tone={p.status === "active" ? "success" : "default"}>{p.status}</Badge>
              <Link to={`/landlord/applicants/${p.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                {count} applicant{count === 1 ? "" : "s"}
              </Link>
              <Link to={`/landlord/properties/${p.id}/edit`} className="text-sm font-medium text-slate-600 hover:underline">
                Edit
              </Link>
              <Button variant="danger" onClick={() => handleDelete(p.id)}>
                Delete
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
