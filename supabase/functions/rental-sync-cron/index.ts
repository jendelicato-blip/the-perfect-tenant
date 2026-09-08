// Rental Property Aggregation Engine — scheduled sync worker.
//
// Invoked by pg_cron (see supabase/migrations/0019_rental_sync_scheduling.sql)
// roughly every 15 minutes. For each active rental_sources row that has both
// a feed_url and a sync_interval_minutes configured, and whose interval has
// actually elapsed since last_synced_at, this fetches that URL's CSV and runs
// it through the exact same pipeline as an admin's manual CSV upload
// (src/pages/admin/RentalAggregation.tsx's "Run CSV sync") — normalize,
// validate, match against existing canonical properties, create/update
// records, log a rental_sync_runs row. Nothing here scrapes anything: a
// source only ever gets synced automatically if an admin explicitly gave it
// a feed_url, which per the license_status model on rental_sources requires
// the source to already be in an activatable state (authorized/licensed/
// partner/user_submitted/public_data — never review_required or disabled).
//
// Auth: this endpoint is deployed with verify_jwt = false (pg_cron has no
// Supabase user session to attach a JWT for), and instead checks the
// `x-cron-secret` header via the verify_rental_sync_cron_secret(text) RPC
// (see the migration) — a SECURITY DEFINER function, executable only by
// service_role, that compares against a value stored in Supabase Vault and
// returns a bare boolean. It's an RPC rather than a direct
// `vault.decrypted_secrets` query because the `vault` schema isn't exposed
// through PostgREST (the REST API this client library talks to) — only a
// wrapper function in `public` is reachable that way, and this one never
// returns the secret itself, only whether the candidate matched. Nothing
// here or in the migration ever hardcodes the secret in a file that gets
// committed to git.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically into
// every Edge Function.

import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeCsvRow, parseCsv, validateParsedRow, type ParsedCsvRow } from "./csv.ts";
import { buildSyncPlan } from "./syncPipeline.ts";
import type { MatchableProperty } from "./matching.ts";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function toMatchableProperty(p: Record<string, unknown>): MatchableProperty {
  return {
    id: p.id as string,
    property_name: p.property_name as string,
    address: p.address as string,
    city: p.city as string,
    state: p.state as string,
    zip: p.zip as string,
    latitude: p.latitude as number | null,
    longitude: p.longitude as number | null,
    management_company: p.management_company as string | null,
    management_contact: p.management_contact as { phone?: string } | null,
    website: p.website as string | null,
  };
}

interface DueSource {
  id: string;
  connector_key: string;
  priority_rank: number;
  feed_url: string;
}

async function syncOneSource(source: DueSource) {
  const now = new Date().toISOString();

  let csvText: string;
  try {
    const res = await fetch(source.feed_url);
    if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
    csvText = await res.text();
  } catch (err) {
    await service.from("rental_sync_runs").insert({
      source_id: source.id,
      status: "failed",
      finished_at: now,
      errors_count: 1,
      error_log: [{ message: `Could not fetch feed_url: ${err instanceof Error ? err.message : String(err)}` }],
    });
    return;
  }

  const parsedRows = parseCsv(csvText);
  const rows: ParsedCsvRow[] = [];
  const issues: Array<{ rowIndex: number; field?: string; message: string }> = [];
  parsedRows.forEach((raw, i) => {
    const normalized = normalizeCsvRow(raw);
    issues.push(...validateParsedRow(normalized, i));
    rows.push(normalized);
  });

  const { data: existingSources } = await service
    .from("agg_property_sources")
    .select("source_property_id, agg_property_id")
    .eq("source_id", source.id);
  const existingSourcePropertyMap = new Map<string, string>(
    (existingSources ?? []).map((r) => [r.source_property_id as string, r.agg_property_id as string]),
  );

  const cities = [...new Set(rows.map((r) => r.property.city))];
  const states = [...new Set(rows.map((r) => r.property.state))];
  let candidateProperties: MatchableProperty[] = [];
  if (cities.length > 0) {
    const { data: candidates } = await service.from("agg_properties").select("*").in("city", cities).in("state", states);
    candidateProperties = (candidates ?? []).map(toMatchableProperty);
  }

  const { data: freshnessRow } = await service.from("agg_freshness_config").select("duplicate_match_threshold").eq("id", "default").maybeSingle();
  const duplicateMatchThreshold = freshnessRow?.duplicate_match_threshold ?? 0.72;

  const plan = buildSyncPlan({ rows, issues, existingSourcePropertyMap, candidateProperties, duplicateMatchThreshold });

  let propertiesCreated = 0;
  let propertiesUpdated = 0;
  let unitsCreated = 0;
  let unitsUpdated = 0;
  let duplicatesCreated = 0;

  for (const item of plan.items) {
    let aggPropertyId: string;

    if (item.existingAggPropertyId) {
      aggPropertyId = item.existingAggPropertyId;
      await service
        .from("agg_property_sources")
        .update({ raw_data: item.property.raw_data, last_seen: now, updated_at: now })
        .eq("source_id", source.id)
        .eq("source_property_id", item.sourcePropertyId);

      const { data: existingProperty } = await service.from("agg_properties").select("primary_source_id").eq("id", aggPropertyId).maybeSingle();
      let winsPriority = true;
      if (existingProperty?.primary_source_id) {
        const { data: currentPrimary } = await service.from("rental_sources").select("priority_rank").eq("id", existingProperty.primary_source_id).maybeSingle();
        winsPriority = !currentPrimary || source.priority_rank <= currentPrimary.priority_rank;
      }
      const propertyPatch: Record<string, unknown> = { last_seen: now, updated_at: now };
      if (winsPriority) {
        Object.assign(propertyPatch, {
          property_name: item.property.property_name,
          property_type: item.property.property_type,
          address: item.property.address,
          city: item.property.city,
          state: item.property.state,
          zip: item.property.zip,
          county: item.property.county,
          latitude: item.property.latitude,
          longitude: item.property.longitude,
          neighborhood: item.property.neighborhood,
          description: item.property.description,
          year_built: item.property.year_built,
          total_units: item.property.total_units,
          amenities: item.property.amenities,
          pet_policy: item.property.pet_policy,
          parking: item.property.parking,
          utilities: item.property.utilities,
          website: item.property.website,
          management_company: item.property.management_company,
          management_contact: item.property.management_contact,
          primary_source_id: source.id,
        });
      }
      await service.from("agg_properties").update(propertyPatch).eq("id", aggPropertyId);
      propertiesUpdated++;
    } else {
      const { data: newProperty, error: insertError } = await service
        .from("agg_properties")
        .insert({
          property_name: item.property.property_name,
          property_type: item.property.property_type,
          address: item.property.address,
          city: item.property.city,
          state: item.property.state,
          zip: item.property.zip,
          county: item.property.county,
          latitude: item.property.latitude,
          longitude: item.property.longitude,
          neighborhood: item.property.neighborhood,
          description: item.property.description,
          year_built: item.property.year_built,
          total_units: item.property.total_units,
          amenities: item.property.amenities,
          pet_policy: item.property.pet_policy,
          parking: item.property.parking,
          utilities: item.property.utilities,
          website: item.property.website,
          management_company: item.property.management_company,
          management_contact: item.property.management_contact,
          primary_source_id: source.id,
          last_seen: now,
        })
        .select()
        .single();
      if (insertError || !newProperty) {
        issues.push({ rowIndex: -1, message: `Failed to create property ${item.sourcePropertyId}: ${insertError?.message}` });
        continue;
      }
      aggPropertyId = newProperty.id as string;
      propertiesCreated++;

      await service.from("agg_property_sources").insert({
        agg_property_id: aggPropertyId,
        source_id: source.id,
        source_property_id: item.sourcePropertyId,
        source_url: item.property.source_url,
        raw_data: item.property.raw_data,
        is_primary: true,
        first_seen: now,
        last_seen: now,
      });

      for (const match of item.duplicateMatches) {
        await service.from("agg_duplicate_candidates").insert({
          property_a_id: aggPropertyId,
          property_b_id: match.existingPropertyId,
          confidence: match.confidence,
          match_reasons: match.reasons,
          status: "pending",
        });
        duplicatesCreated++;
      }
    }

    for (const unit of item.units) {
      const { data: existingUnitSource } = await service
        .from("agg_unit_sources")
        .select("agg_unit_id")
        .eq("source_id", source.id)
        .eq("source_unit_id", unit.source_unit_id)
        .maybeSingle();

      if (existingUnitSource) {
        await service
          .from("agg_unit_sources")
          .update({ raw_data: unit.raw_data, last_seen: now, updated_at: now })
          .eq("source_id", source.id)
          .eq("source_unit_id", unit.source_unit_id);

        const { data: existingUnit } = await service.from("agg_units").select("primary_source_id").eq("id", existingUnitSource.agg_unit_id).maybeSingle();
        let winsPriority = true;
        if (existingUnit?.primary_source_id) {
          const { data: unitPrimary } = await service.from("rental_sources").select("priority_rank").eq("id", existingUnit.primary_source_id).maybeSingle();
          winsPriority = !unitPrimary || source.priority_rank <= unitPrimary.priority_rank;
        }
        const unitPatch: Record<string, unknown> = { last_seen: now, updated_at: now };
        if (winsPriority) {
          Object.assign(unitPatch, {
            unit_number: unit.unit_number,
            floor: unit.floor,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            square_feet: unit.square_feet,
            monthly_rent_cents: unit.monthly_rent_cents,
            rent_min_cents: unit.rent_min_cents,
            rent_max_cents: unit.rent_max_cents,
            deposit_cents: unit.deposit_cents,
            available_date: unit.available_date,
            lease_term: unit.lease_term,
            furnished: unit.furnished,
            pets_allowed: unit.pets_allowed,
            parking: unit.parking,
            utilities: unit.utilities,
            unit_amenities: unit.unit_amenities,
            availability_status: unit.availability_status,
            primary_source_id: source.id,
          });
        }
        await service.from("agg_units").update(unitPatch).eq("id", existingUnitSource.agg_unit_id);
        unitsUpdated++;
      } else {
        const { data: newUnit, error: unitInsertError } = await service
          .from("agg_units")
          .insert({
            agg_property_id: aggPropertyId,
            unit_number: unit.unit_number,
            floor: unit.floor,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            square_feet: unit.square_feet,
            monthly_rent_cents: unit.monthly_rent_cents,
            rent_min_cents: unit.rent_min_cents,
            rent_max_cents: unit.rent_max_cents,
            deposit_cents: unit.deposit_cents,
            available_date: unit.available_date,
            lease_term: unit.lease_term,
            furnished: unit.furnished,
            pets_allowed: unit.pets_allowed,
            parking: unit.parking,
            utilities: unit.utilities,
            unit_amenities: unit.unit_amenities,
            availability_status: unit.availability_status,
            primary_source_id: source.id,
            last_seen: now,
          })
          .select()
          .single();
        if (unitInsertError || !newUnit) {
          issues.push({ rowIndex: -1, message: `Failed to create unit ${unit.source_unit_id}: ${unitInsertError?.message}` });
          continue;
        }
        await service.from("agg_unit_sources").insert({
          agg_unit_id: newUnit.id,
          source_id: source.id,
          source_unit_id: unit.source_unit_id,
          source_url: unit.source_url,
          raw_data: unit.raw_data,
          is_primary: true,
          first_seen: now,
          last_seen: now,
        });
        unitsCreated++;
      }
    }
  }

  await service.from("rental_sources").update({ last_synced_at: now }).eq("id", source.id);

  await service.from("rental_sync_runs").insert({
    source_id: source.id,
    status: rows.length === 0 ? "failed" : issues.length > 0 ? "partial" : "succeeded",
    finished_at: now,
    properties_seen: plan.items.length,
    properties_created: propertiesCreated,
    properties_updated: propertiesUpdated,
    units_seen: rows.length,
    units_created: unitsCreated,
    units_updated: unitsUpdated,
    duplicate_candidates_created: duplicatesCreated,
    errors_count: issues.length,
    error_log: issues.map((i) => ({ message: i.message, row: i.rowIndex, field: i.field })),
    triggered_by: null, // automated — see the file header
  });
}

Deno.serve(async (req: Request) => {
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  const { data: verified, error: verifyError } = await service.rpc("verify_rental_sync_cron_secret", {
    candidate: providedSecret,
  });
  if (verifyError || !verified) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { data: sources, error } = await service
    .from("rental_sources")
    .select("id, connector_key, priority_rank, feed_url, sync_interval_minutes, last_synced_at")
    .eq("active", true)
    .not("feed_url", "is", null)
    .not("sync_interval_minutes", "is", null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const now = Date.now();
  const due = (sources ?? []).filter((s) => {
    if (!s.last_synced_at) return true;
    const elapsedMinutes = (now - new Date(s.last_synced_at).getTime()) / 60000;
    return elapsedMinutes >= s.sync_interval_minutes;
  });

  for (const source of due) {
    await syncOneSource({
      id: source.id,
      connector_key: source.connector_key,
      priority_rank: source.priority_rank,
      feed_url: source.feed_url as string,
    });
  }

  return new Response(JSON.stringify({ checked: sources?.length ?? 0, synced: due.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
