import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "../utils/db.js";
import type { AgentRunStatus } from "../agent-runs/types.js";
import type { SeoDiagnostic, Target } from "../types/index.js";
import type { SiteDetail, SiteProposalRecord, SiteRecord, SiteSnapshotRecord } from "./types.js";

type JsonObject = Record<string, unknown>;

export interface PersistSiteResultInput {
  runId: string;
  status: Exclude<AgentRunStatus, "running">;
  target: Target;
  summary?: JsonObject;
  createdAt: Date;
  proposals?: Array<{
    label: string;
    pathOrUrl?: string;
    contentText?: string;
    metadata?: JsonObject;
  }>;
}

type SiteRow = {
  id: string;
  normalized_url: string;
  display_url: string;
  domain: string;
  latest_status: AgentRunStatus;
  latest_seo_score: number | null;
  latest_run_id: string | null;
  latest_snapshot_id: string | null;
  created_at: number;
  updated_at: number;
};

type SnapshotRow = {
  id: string;
  site_id: string;
  run_id: string | null;
  target_url: string;
  domain: string;
  status: AgentRunStatus;
  seo_score: number | null;
  diagnostics_json: string;
  summary_json: string;
  created_at: number;
};

type ProposalRow = {
  id: string;
  site_id: string;
  snapshot_id: string;
  run_id: string | null;
  label: string;
  path_or_url: string | null;
  content_text: string | null;
  metadata_json: string;
  created_at: number;
};

export async function persistSiteResult(input: PersistSiteResultInput): Promise<SiteDetail> {
  const db = await getDb();
  const normalizedUrl = normalizeTargetUrl(input.target.url);
  const siteId = toSiteId(normalizedUrl);
  const snapshotId = randomUUID();
  const now = input.createdAt.getTime();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO analyzed_sites (
        id, normalized_url, display_url, domain, latest_status, latest_seo_score,
        latest_run_id, latest_snapshot_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(normalized_url) DO UPDATE SET
        display_url = excluded.display_url,
        domain = excluded.domain,
        latest_status = excluded.latest_status,
        latest_seo_score = excluded.latest_seo_score,
        latest_run_id = excluded.latest_run_id,
        latest_snapshot_id = excluded.latest_snapshot_id,
        updated_at = excluded.updated_at`
    ).run(
      siteId,
      normalizedUrl,
      input.target.url,
      input.target.domain,
      input.status,
      input.target.seoScore,
      input.runId,
      snapshotId,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO site_snapshots (
        id, site_id, run_id, target_url, domain, status, seo_score,
        diagnostics_json, summary_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      snapshotId,
      siteId,
      input.runId,
      input.target.url,
      input.target.domain,
      input.status,
      input.target.seoScore,
      jsonDiagnostics(input.target.diagnostics),
      json(input.summary ?? {}),
      now,
    );

    const insertProposal = db.prepare(
      `INSERT INTO site_proposals (
        id, site_id, snapshot_id, run_id, label, path_or_url, content_text, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const proposal of input.proposals ?? []) {
      insertProposal.run(
        randomUUID(),
        siteId,
        snapshotId,
        input.runId,
        proposal.label,
        proposal.pathOrUrl ?? null,
        proposal.contentText ?? null,
        json(proposal.metadata ?? {}),
        now,
      );
    }
  });

  tx();
  const detail = await getSiteDetail(siteId);
  if (!detail) throw new Error(`Failed to load persisted site result ${siteId}`);
  return detail;
}

export async function listSites(limit = 100): Promise<SiteRecord[]> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT * FROM analyzed_sites ORDER BY updated_at DESC LIMIT ?")
    .all(Math.max(1, Math.min(limit, 500))) as SiteRow[];
  return rows.map(mapSiteRow);
}

export async function getSiteDetail(id: string): Promise<SiteDetail | null> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM analyzed_sites WHERE id = ?").get(id) as SiteRow | undefined;
  if (!row) return null;

  const snapshots = db
    .prepare("SELECT * FROM site_snapshots WHERE site_id = ? ORDER BY created_at DESC")
    .all(id) as SnapshotRow[];
  const proposals = db
    .prepare("SELECT * FROM site_proposals WHERE site_id = ? ORDER BY created_at DESC")
    .all(id) as ProposalRow[];

  return {
    ...mapSiteRow(row),
    snapshots: snapshots.map(mapSnapshotRow),
    proposals: proposals.map(mapProposalRow),
  };
}

export async function getSitesDb(): Promise<Database.Database> {
  return getDb();
}

export function normalizeTargetUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function toSiteId(normalizedUrl: string): string {
  return `site_${createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 24)}`;
}

function mapSiteRow(row: SiteRow): SiteRecord {
  return {
    id: row.id,
    normalizedUrl: row.normalized_url,
    displayUrl: row.display_url,
    domain: row.domain,
    latestStatus: row.latest_status,
    latestSeoScore: row.latest_seo_score ?? undefined,
    latestRunId: row.latest_run_id ?? undefined,
    latestSnapshotId: row.latest_snapshot_id ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapSnapshotRow(row: SnapshotRow): SiteSnapshotRecord {
  return {
    id: row.id,
    siteId: row.site_id,
    runId: row.run_id ?? undefined,
    targetUrl: row.target_url,
    domain: row.domain,
    status: row.status,
    seoScore: row.seo_score ?? undefined,
    diagnostics: parseDiagnostics(row.diagnostics_json),
    summary: parseJson(row.summary_json),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapProposalRow(row: ProposalRow): SiteProposalRecord {
  return {
    id: row.id,
    siteId: row.site_id,
    snapshotId: row.snapshot_id,
    runId: row.run_id ?? undefined,
    label: row.label,
    pathOrUrl: row.path_or_url ?? undefined,
    contentText: row.content_text ?? undefined,
    metadata: parseJson(row.metadata_json),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function json(value: JsonObject): string {
  return JSON.stringify(value);
}

function jsonDiagnostics(value: SeoDiagnostic[]): string {
  return JSON.stringify(value);
}

function parseJson(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function parseDiagnostics(value: string): SeoDiagnostic[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as SeoDiagnostic[]) : [];
  } catch {
    return [];
  }
}
