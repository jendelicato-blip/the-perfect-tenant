import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import * as api from "@/lib/data/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory, type PlusMembershipConfig, type TenantDocument, type TenantPlusMembership } from "@/types/domain";

const BENEFITS = [
  "Document Vault — upload identity, income, and lease documents once, reuse them across every application",
  "Enhanced Passport presentation",
  "Priority Passport sharing",
  "Access to Perfect Rent™ and Perfect Pay™ benefits your free Passport already has — Plus never re-gates those",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentRow({ doc, onDelete }: { doc: TenantDocument; onDelete: () => void }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await api.getTenantDocumentUrl(doc.storage_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
      <div>
        <p className="font-medium text-slate-900">{doc.file_name}</p>
        <p className="text-xs text-slate-500">
          {DOCUMENT_CATEGORY_LABELS[doc.category]} · {formatBytes(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
        >
          {downloading ? "Opening…" : "View"}
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function TenantPlus() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [config, setConfig] = useState<PlusMembershipConfig | null>(null);
  const [membership, setMembership] = useState<TenantPlusMembership | null>(null);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [category, setCategory] = useState<DocumentCategory>("identity");
  const [purchasing, setPurchasing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkoutResult = searchParams.get("checkout");

  async function load() {
    if (!user) return;
    const [c, m, docs] = await Promise.all([
      api.getPlusMembershipConfig(),
      api.getOwnPlusMembership(user.id),
      api.listTenantDocuments(user.id),
    ]);
    setConfig(c);
    setMembership(m);
    setDocuments(docs);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (checkoutResult) {
      if (checkoutResult === "success") load();
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutResult]);

  const isActive = membership?.status === "active";

  async function handlePurchase() {
    if (!user || !config) return;
    setPurchasing(true);
    try {
      const checkoutUrl = await api.startPlusCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      // No live Stripe checkout configured — same Phase 1 fallback as
      // Verified and landlord subscriptions.
      await api.activatePlusDirect(user.id);
      await load();
    } finally {
      setPurchasing(false);
    }
  }

  async function handleCancel() {
    if (!user) return;
    await api.cancelPlusMembership(user.id);
    await load();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      await api.uploadTenantDocument(user.id, file, category);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    await api.deleteTenantDocument(documentId);
    await load();
  }

  if (!config) return <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading…</div>;

  const priceDollars = (config.price_cents / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-700">
        ⭐ Perfect10ant Plus™
      </span>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">A stronger Passport, organized in one place.</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your free Passport and verification steps stay exactly as useful as they've always been — Plus never re-gates
        anything free behind a paywall. What it adds is real: a persistent Document Vault you build once and reuse
        everywhere.
      </p>

      {checkoutResult === "cancelled" && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Checkout was cancelled — no changes were made.
        </p>
      )}

      {!isActive && (
        <>
          <Card className="mt-6 p-6">
            <h2 className="font-semibold text-slate-900">What you get</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="text-brand-600">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Button className="mt-4 w-full" onClick={handlePurchase} disabled={purchasing}>
            {purchasing ? "Starting checkout…" : `Join Perfect10ant Plus — $${priceDollars}/${config.billing_period}`}
          </Button>
        </>
      )}

      {isActive && membership && (
        <>
          <Card className="mt-6 border-gold-300 bg-gold-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gold-700">⭐ You're a Plus member</p>
                <p className="mt-1 text-sm text-gold-900">
                  ${priceDollars}/{config.billing_period}
                  {membership.renews_at && ` · renews ${new Date(membership.renews_at).toLocaleDateString()}`}
                </p>
              </div>
              <button onClick={handleCancel} className="text-xs font-medium text-gold-700 underline hover:text-gold-900">
                Cancel membership
              </button>
            </div>
          </Card>

          <Card className="mt-4 p-6">
            <h2 className="font-semibold text-slate-900">Document Vault</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload identity, income, and lease documents once — reuse them across every application. Stored
              privately; only you can access your own files.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className="w-44">
                {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload document"}
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            </div>

            {documents.length === 0 && <p className="mt-4 text-sm text-slate-500">No documents uploaded yet.</p>}
            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} onDelete={() => handleDelete(doc.id)} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
