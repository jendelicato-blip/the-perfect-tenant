// Rental Aggregation Engine — the generic connector contract (spec section
// 21: "Build the architecture so additional sources can be added without
// redesigning the database").
//
// Every future source integration — a real property-management API, an XML
// syndication feed, a licensed data provider's REST endpoint — implements
// this interface. Nothing in the sync pipeline, matching engine, or admin UI
// needs to change when a new connector is added; only `CONNECTORS` below
// grows by one entry.
//
// `csv_upload` is the only connector implemented in this phase. It's
// necessarily push-based (an admin supplies the file rather than the
// connector fetching it over the network), so `fetchRaw` for it just parses
// the text it's handed instead of calling out to anything — see csv.ts. A
// pull-based connector (an API/feed source) would implement `fetchRaw` by
// authenticating and making the actual HTTP calls; everything downstream
// (normalize/validate/sync) is identical either way.

import { normalizeCsvRow, parseCsv, validateParsedRow, type ParsedCsvRow, type ValidationIssue } from "./csv";

export interface ConnectorSyncInput {
  /** Raw payload for this run — a CSV upload's text content today; a future
   *  API connector would ignore this and fetch over the network instead. */
  payload?: string;
}

export interface ConnectorSyncResult {
  rows: ParsedCsvRow[];
  issues: ValidationIssue[];
}

export interface SourceConnector {
  key: string;
  /** Verify credentials/access. CSV upload has none — always resolves. */
  authenticate(): Promise<void>;
  /** Fetch + normalize + validate raw source data into the rows the sync
   *  pipeline consumes. For CSV this parses `input.payload`; a real API
   *  connector would call the provider's endpoints here instead. */
  fetchAndNormalize(input: ConnectorSyncInput): Promise<ConnectorSyncResult>;
}

export const csvUploadConnector: SourceConnector = {
  key: "csv_upload",
  async authenticate() {
    // No credentials to check for a manual upload.
  },
  async fetchAndNormalize({ payload }) {
    if (!payload) return { rows: [], issues: [{ rowIndex: -1, message: "No file uploaded" }] };
    const parsedRows = parseCsv(payload);
    const rows: ParsedCsvRow[] = [];
    const issues: ValidationIssue[] = [];
    parsedRows.forEach((raw, i) => {
      const normalized = normalizeCsvRow(raw);
      issues.push(...validateParsedRow(normalized, i));
      rows.push(normalized);
    });
    return { rows, issues };
  },
};

export const CONNECTORS: Record<string, SourceConnector> = {
  csv_upload: csvUploadConnector,
};

export function getConnector(key: string): SourceConnector | null {
  return CONNECTORS[key] ?? null;
}
