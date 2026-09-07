import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { Badge } from "@/components/ui/Badge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { InvitationStatus, PropertyWithPhotos, TenantInvitation } from "@/types/domain";

export function TenantInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [properties, setProperties] = useState<Record<string, PropertyWithPhotos>>({});

  async function load() {
    if (!user) return;
    const invites = await api.listInvitationsForTenant(user.id);
    setInvitations(invites);
    const props = await Promise.all([...new Set(invites.map((i) => i.property_id))].map((id) => api.getProperty(id)));
    setProperties(Object.fromEntries(props.filter((p): p is PropertyWithPhotos => p !== null).map((p) => [p.id, p])));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function respond(id: string, status: InvitationStatus) {
    await api.respondToInvitation(id, status);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BackButton fallback="/home" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Landlord Interest</h1>
      <p className="mt-1 text-sm text-slate-600">Landlords who invited you to apply based on your Perfect10ant Passport.</p>

      <div className="mt-6 space-y-4">
        {invitations.length === 0 && <p className="text-sm text-slate-500">No landlord interest yet.</p>}
        {invitations.map((inv) => {
          const property = properties[inv.property_id];
          return (
            <Card key={inv.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">A landlord is interested in your Perfect10ant Passport.</p>
                  {property && (
                    <p className="mt-1 text-sm text-slate-600">
                      {property.address} · ${property.rent.toLocaleString()}/mo · {property.city}, {property.state}
                    </p>
                  )}
                  {inv.message && <p className="mt-2 text-sm italic text-slate-500">"{inv.message}"</p>}
                </div>
                <Badge tone={inv.status === "accepted" ? "success" : inv.status === "declined" ? "default" : "brand"}>{inv.status}</Badge>
              </div>
              {inv.status === "sent" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {property && (
                    <Link
                      to={`/properties/${property.id}`}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      View listing
                    </Link>
                  )}
                  <Button onClick={() => respond(inv.id, "accepted")}>Accept</Button>
                  <Button variant="secondary" onClick={() => respond(inv.id, "declined")}>
                    Decline
                  </Button>
                </div>
              )}
              {inv.status === "accepted" && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {property && (
                    <Link to={`/properties/${property.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      View listing &amp; apply
                    </Link>
                  )}
                  <button
                    onClick={() => respond(inv.id, "sent")}
                    className="text-sm font-medium text-slate-400 underline decoration-dotted hover:text-slate-600"
                  >
                    Accepted by mistake? Undo
                  </button>
                </div>
              )}
              {inv.status === "declined" && (
                <div className="mt-3">
                  <button
                    onClick={() => respond(inv.id, "sent")}
                    className="text-sm font-medium text-slate-400 underline decoration-dotted hover:text-slate-600"
                  >
                    Declined by mistake? Undo
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
