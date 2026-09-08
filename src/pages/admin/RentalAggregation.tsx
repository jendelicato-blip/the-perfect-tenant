import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import {
  AGG_AVAILABILITY_STATUS_LABELS,
  AGG_PROPERTY_TYPE_LABELS,
  DATA_LICENSE_STATUS_LABELS,
  RENTAL_SOURCE_TYPE_LABELS,
  type AggDuplicateCandidate,
  type AggFreshnessConfig,
  type AggProperty,
  type AggUnit,
  type DataLicenseStatus,
  type RentalSourceType,
  type RentalSyncRun,
} from "@/types/domain";
import type { RentalAggregationSummary, SourceStats } from "@/lib/data/api";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

function licenseTone(status: DataLicenseStatus): "default" | "brand" | "success" | "warning" {
  if (status === "review_required") return "warning";
  if (status === "disabled") return "default";
  return "success";
}

function formatMoney(cents: number | null): string {
  return cents === null ? "—" : `$${(cents / 100).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function nextScheduledSync(lastSyncedAt: string | null, syncIntervalMinutes: number | null): string {
  if (!syncIntervalMinutes) return "—";
  const base = lastSyncedAt ? new Date(lastSyncedAt).getTime() : Date.now();
  const due = new Date(base + syncIntervalMinutes * 60_000);
  return due.getTime() <= Date.now() ? "Due now (next 15-min cron tick)" : due.toLocaleString();
}

// ---------- Add source ----------

function AddSourceForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<RentalSourceType>("direct_property_manager");
  const [licenseStatus, setLicenseStatus] = useState<DataLicenseStatus>("review_required");
  const [priorityRank, setPriorityRank] = useState("3");
  const [contactEmail, setContactEmail] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createRentalSource({
        name: name.trim(),
        source_type: sourceType,
        license_status: licenseStatus,
        connector_key: "csv_upload",
        priority_rank: Number(priorityRank) || 5,
        feed_url: feedUrl.trim() || null,
        sync_interval_minutes: syncIntervalMinutes.trim() ? Number(syncIntervalMinutes) : null,
        rate_limit_per_hour: null,
        contact_name: null,
        contact_email: contactEmail.trim() || null,
        notes: notes.trim() || null,
      });
      setName("");
      setContactEmail("");
      setFeedUrl("");
      setSyncIntervalMinutes("");
      setNotes("");
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-800">Register a new source</p>
      <p className="mt-1 text-xs text-slate-500">
        A new source always starts as <strong>review_required</strong> and inactive — nothing can sync until an admin
        confirms the license status and activates it below (enforced by a database constraint, not just this form).
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input placeholder="Source name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as RentalSourceType)}>
          {(Object.keys(RENTAL_SOURCE_TYPE_LABELS) as RentalSourceType[]).map((t) => (
            <option key={t} value={t}>
              {RENTAL_SOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={licenseStatus} onChange={(e) => setLicenseStatus(e.target.value as DataLicenseStatus)}>
          {(Object.keys(DATA_LICENSE_STATUS_LABELS) as DataLicenseStatus[]).map((s) => (
            <option key={s} value={s}>
              {DATA_LICENSE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input type="number" min={1} max={5} placeholder="Priority rank (1=highest)" value={priorityRank} onChange={(e) => setPriorityRank(e.target.value)} />
        <Input placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <Input placeholder="Notes (licensing terms, contact context...)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input placeholder="Feed URL (optional — enables scheduled sync)" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
        <Input
          type="number"
          min={1}
          placeholder="Sync every N minutes (requires feed URL)"
          value={syncIntervalMinutes}
          onChange={(e) => setSyncIntervalMinutes(e.target.value)}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        When both a feed URL and a sync interval are set, the scheduled sync job (runs every 15 minutes) fetches that
        URL's CSV automatically once the source is active — no admin upload required.
      </p>
      <Button className="mt-3" disabled={saving || !name.trim()} onClick={submit}>
        {saving ? "Adding…" : "Add source"}
      </Button>
    </Card>
  );
}

// ---------- Source row ----------

function SourceRow({ stats, onChanged }: { stats: SourceStats; onChanged: () => void }) {
  const { source } = stats;
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [feedUrlDraft, setFeedUrlDraft] = useState(source.feed_url ?? "");
  const [syncIntervalDraft, setSyncIntervalDraft] = useState(source.sync_interval_minutes?.toString() ?? "");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const canActivate = source.license_status !== "review_required" && source.license_status !== "disabled";

  async function toggleActive() {
    if (!source.active && !canActivate) return;
    await api.updateRentalSource(source.id, { active: !source.active });
    onChanged();
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      await api.updateRentalSource(source.id, {
        feed_url: feedUrlDraft.trim() || null,
        sync_interval_minutes: syncIntervalDraft.trim() ? Number(syncIntervalDraft) : null,
      });
      setScheduleOpen(false);
      onChanged();
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  async function runSync() {
    if (!csvText.trim()) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const run = await api.runCsvSync(source.id, csvText);
      setSyncMessage(
        `${run.status.toUpperCase()}: ${run.properties_created} new / ${run.properties_updated} updated properties, ` +
          `${run.units_created} new / ${run.units_updated} updated units, ${run.duplicate_candidates_created} duplicate candidate(s), ${run.errors_count} error(s).`,
      );
      setCsvText("");
      onChanged();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{source.name}</p>
          <p className="text-xs text-slate-500">{RENTAL_SOURCE_TYPE_LABELS[source.source_type]} · connector: {source.connector_key} · priority {source.priority_rank}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={licenseTone(source.license_status)}>{DATA_LICENSE_STATUS_LABELS[source.license_status]}</Badge>
            <Badge tone={source.active ? "success" : "default"}>{source.active ? "Active" : "Inactive"}</Badge>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>{stats.propertiesImported} properties · {stats.unitsImported} units imported</p>
          <p>Last synced: {formatDate(source.last_synced_at)}</p>
          {source.feed_url && (
            <p>
              Scheduled sync: every {source.sync_interval_minutes ?? "?"} min · next{" "}
              {nextScheduledSync(source.last_synced_at, source.sync_interval_minutes)}
            </p>
          )}
        </div>
      </div>

      {source.notes && <p className="mt-2 whitespace-pre-line text-xs text-slate-400">{source.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={toggleActive}
          disabled={!source.active && !canActivate}
          title={!source.active && !canActivate ? "License status must be resolved before this source can be activated" : undefined}
        >
          {source.active ? "Deactivate" : "Activate"}
        </Button>
        <Button variant="secondary" onClick={() => setCsvOpen((v) => !v)} disabled={!source.active}>
          {csvOpen ? "Close" : "Run CSV sync"}
        </Button>
        <Button variant="secondary" onClick={() => setScheduleOpen((v) => !v)}>
          {scheduleOpen ? "Close" : "Edit schedule"}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            const note = window.prompt("Reason for marking this source unreliable?");
            if (note) api.markSourceUnreliable(source.id, note).then(onChanged);
          }}
        >
          Mark unreliable
        </Button>
      </div>

      {scheduleOpen && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            When both fields are set and this source is active, the scheduled sync job (pg_cron, every 15 minutes)
            fetches the feed URL's CSV automatically once the interval below has elapsed — no manual upload needed.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input placeholder="Feed URL" value={feedUrlDraft} onChange={(e) => setFeedUrlDraft(e.target.value)} />
            <Input
              type="number"
              min={1}
              placeholder="Sync every N minutes"
              value={syncIntervalDraft}
              onChange={(e) => setSyncIntervalDraft(e.target.value)}
            />
          </div>
          <Button disabled={savingSchedule} onClick={saveSchedule}>
            {savingSchedule ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      )}

      {csvOpen && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Upload or paste a CSV export (one row per unit; see docs/ARCHITECTURE.md for the column list). This is the
            only connector implemented so far — see the source-management architecture notes for how a real API/feed
            connector plugs in later.
          </p>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-xs" />
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="property_name,property_type,address,city,state,zip,source_property_id,unit_number,bedrooms,bathrooms,monthly_rent,availability_status,source_unit_id..."
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button disabled={syncing || !csvText.trim()} onClick={runSync}>
            {syncing ? "Syncing…" : "Run sync now"}
          </Button>
          {syncMessage && <p className="text-xs text-slate-600">{syncMessage}</p>}
        </div>
      )}
    </Card>
  );
}

// ---------- Sync run history ----------

function SyncRunHistory({ runs }: { runs: RentalSyncRun[] }) {
  if (runs.length === 0) return <p className="text-sm text-slate-500">No sync runs yet.</p>;
  return (
    <div className="space-y-2">
      {runs.slice(0, 15).map((run) => (
        <Card key={run.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div>
            <Badge tone={run.status === "succeeded" ? "success" : run.status === "failed" ? "warning" : "default"}>
              {run.status}
            </Badge>
            <span className="ml-1">
              <Badge tone="default">{run.triggered_by ? "Manual" : "Scheduled"}</Badge>
            </span>
            <span className="ml-2 text-slate-500">{formatDate(run.started_at)}</span>
          </div>
          <p className="text-xs text-slate-500">
            {run.properties_created}+{run.properties_updated} properties · {run.units_created}+{run.units_updated} units ·{" "}
            {run.duplicate_candidates_created} dup candidates · {run.errors_count} errors
          </p>
        </Card>
      ))}
    </div>
  );
}

// ---------- Inventory browser ----------

function PropertyRow({ property }: { property: AggProperty }) {
  const [expanded, setExpanded] = useState(false);
  const [units, setUnits] = useState<AggUnit[] | null>(null);

  async function toggle() {
    if (!expanded && units === null) {
      setUnits(await api.listAggUnitsForProperty(property.id));
    }
    setExpanded((v) => !v);
  }

  async function verify() {
    await api.verifyAggProperty(property.id);
  }

  async function markInactive() {
    await api.markAggPropertyInactive(property.id);
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button className="text-left font-medium text-slate-900 hover:underline" onClick={toggle}>
            {property.property_name}
          </button>
          <p className="text-xs text-slate-500">
            {property.address}, {property.city}, {property.state} {property.zip} · {AGG_PROPERTY_TYPE_LABELS[property.property_type]}
          </p>
          <p className="text-xs text-slate-400">{property.management_company ?? "No management company on file"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={property.verification_status === "verified" ? "success" : property.verification_status === "needs_verification" ? "warning" : "default"}>
            {property.verification_status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-slate-400">Trust {property.trust_score}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={verify}>
          Mark verified
        </Button>
        <Button variant="danger" onClick={markInactive}>
          Mark inactive
        </Button>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {units === null ? (
            <p className="text-xs text-slate-400">Loading units…</p>
          ) : units.length === 0 ? (
            <p className="text-xs text-slate-400">No units on file for this property.</p>
          ) : (
            <div className="space-y-1">
              {units.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    Unit {u.unit_number ?? "—"} · {u.bedrooms ?? "—"} bd / {u.bathrooms ?? "—"} ba
                    {u.square_feet ? ` · ${u.square_feet} sqft` : ""} · {formatMoney(u.monthly_rent_cents)}
                    {u.available_date ? ` · available ${u.available_date}` : ""}
                  </span>
                  <Badge tone={u.availability_status === "available" ? "success" : "default"}>
                    {AGG_AVAILABILITY_STATUS_LABELS[u.availability_status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Duplicate review ----------

function DuplicateCandidateRow({
  candidate,
  properties,
  reviewerId,
  onResolved,
}: {
  candidate: AggDuplicateCandidate;
  properties: Map<string, AggProperty>;
  reviewerId: string;
  onResolved: () => void;
}) {
  const a = properties.get(candidate.property_a_id);
  const b = properties.get(candidate.property_b_id);

  async function resolve(action: "merge" | "keep_separate" | "ignore") {
    await api.resolveDuplicateCandidate(candidate.id, action, reviewerId);
    onResolved();
  }

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
        Possible duplicate — {Math.round(candidate.confidence * 100)}% confidence
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-2 text-sm">
          <p className="font-medium text-slate-900">{a?.property_name ?? "(property removed)"}</p>
          <p className="text-xs text-slate-500">{a ? `${a.address}, ${a.city}, ${a.state} ${a.zip}` : ""}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-sm">
          <p className="font-medium text-slate-900">{b?.property_name ?? "(property removed)"}</p>
          <p className="text-xs text-slate-500">{b ? `${b.address}, ${b.city}, ${b.state} ${b.zip}` : ""}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Matched on: {candidate.match_reasons.join(", ") || "—"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => resolve("merge")}>Merge (keep A)</Button>
        <Button variant="secondary" onClick={() => resolve("keep_separate")}>
          Keep separate
        </Button>
        <Button variant="ghost" onClick={() => resolve("ignore")}>
          Ignore
        </Button>
      </div>
    </Card>
  );
}

// ---------- Freshness config ----------

function FreshnessConfigEditor({ config, onSaved }: { config: AggFreshnessConfig; onSaved: () => void }) {
  const [needsVerification, setNeedsVerification] = useState(String(config.needs_verification_days));
  const [reducedRanking, setReducedRanking] = useState(String(config.reduced_ranking_days));
  const [autoInactive, setAutoInactive] = useState(String(config.auto_inactive_days));
  const [threshold, setThreshold] = useState(String(config.duplicate_match_threshold));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.updateFreshnessConfig({
        needs_verification_days: Number(needsVerification) || config.needs_verification_days,
        reduced_ranking_days: Number(reducedRanking) || config.reduced_ranking_days,
        auto_inactive_days: Number(autoInactive) || config.auto_inactive_days,
        duplicate_match_threshold: Number(threshold) || config.duplicate_match_threshold,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Needs verification after
        <Input type="number" min={1} value={needsVerification} onChange={(e) => setNeedsVerification(e.target.value)} className="w-16" /> days
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Reduced ranking after
        <Input type="number" min={1} value={reducedRanking} onChange={(e) => setReducedRanking(e.target.value)} className="w-16" /> days
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Auto-inactive after
        <Input type="number" min={1} value={autoInactive} onChange={(e) => setAutoInactive(e.target.value)} className="w-16" /> days
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Duplicate review threshold
        <Input type="number" min={0} max={1} step={0.01} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-20" />
      </label>
      <Button variant="secondary" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}

// ---------- Page ----------

export function RentalAggregationAdmin() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<RentalAggregationSummary | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [runs, setRuns] = useState<RentalSyncRun[]>([]);
  const [properties, setProperties] = useState<AggProperty[]>([]);
  const [candidates, setCandidates] = useState<AggDuplicateCandidate[]>([]);
  const [freshness, setFreshness] = useState<AggFreshnessConfig | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [s, stats, r, props, dupes, fc] = await Promise.all([
      api.getRentalAggregationSummary(),
      api.getSourceStats(),
      api.listSyncRuns(),
      api.listAggProperties(cityFilter ? { city: cityFilter } : undefined),
      api.listDuplicateCandidates("pending"),
      api.getFreshnessConfig(),
    ]);
    setSummary(s);
    setSourceStats(stats);
    setRuns(r);
    setProperties(props);
    setCandidates(dupes);
    setFreshness(fc);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter]);

  const propertyMap = new Map(properties.map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackButton fallback="/admin" className="mb-4" />
      <h1 className="text-2xl font-bold text-slate-900">Rental Property Aggregation Engine</h1>
      <p className="mt-1 text-sm text-slate-600">
        Admin-only inventory aggregation from multiple legitimate sources (direct property managers, licensed feeds,
        user submissions). Nothing here is shown in the public tenant marketplace yet — see docs/ARCHITECTURE.md for
        the phased rollout plan.
      </p>

      {!loading && summary && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-slate-900">Inventory</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Active properties" value={summary.totalProperties} />
            <StatTile label="Available units" value={summary.totalActiveUnits} />
            <StatTile label="New today" value={summary.newPropertiesToday} />
            <StatTile label="Updated today" value={summary.updatedPropertiesToday} />
            <StatTile label="Needs verification" value={summary.needsVerificationCount} />
            <StatTile label="Expired/inactive" value={summary.expiredPropertiesCount} />
            <StatTile label="Pending duplicate reviews" value={summary.pendingDuplicateCandidates} />
            <StatTile label="Failed sync runs" value={summary.failedSyncRunsCount} />
          </div>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">Data Quality</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Duplicate rate" value={`${summary.duplicateRatePercent}%`} />
            <StatTile label="Missing rent" value={summary.missingRentCount} />
            <StatTile label="Missing photos" value={summary.missingPhotosCount} />
            <StatTile label="Missing availability date" value={summary.missingAvailabilityDateCount} />
            <StatTile label="Stale listings" value={summary.staleListingsCount} />
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Freshness thresholds</h2>
      {freshness && <div className="mt-4"><FreshnessConfigEditor config={freshness} onSaved={load} /></div>}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Sources</h2>
      <div className="mt-4 space-y-3">
        {sourceStats.map((stats) => (
          <SourceRow key={stats.source.id} stats={stats} onChanged={load} />
        ))}
        <AddSourceForm onCreated={load} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Recent sync runs</h2>
      <div className="mt-4">
        <SyncRunHistory runs={runs} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Duplicate review queue</h2>
      <p className="text-sm text-slate-600">
        The matching engine only ever proposes a match here — nothing is ever merged automatically.
      </p>
      <div className="mt-4 space-y-3">
        {candidates.length === 0 && <p className="text-sm text-slate-500">No pending duplicate candidates.</p>}
        {candidates.map((c) => (
          <DuplicateCandidateRow key={c.id} candidate={c} properties={propertyMap} reviewerId={user?.id ?? ""} onResolved={load} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Inventory browser</h2>
        <Input placeholder="Filter by city" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-48" />
      </div>
      <div className="mt-4 space-y-3">
        {!loading && properties.length === 0 && <p className="text-sm text-slate-500">No properties in inventory yet.</p>}
        {properties.map((p) => (
          <PropertyRow key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}
