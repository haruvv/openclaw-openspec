import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import { getDb } from "../utils/db.js";
import { sanitizeProviderMetadata } from "./normalization.js";
import type {
  LeadPriorityScore,
  LeadRouteDecision,
  LeadStageEvent,
  SiteCandidate,
  SourceProvenance,
} from "./types.js";

type JsonObject = Record<string, unknown>;

type LeadCandidateRow = {
  id: string;
  normalized_url: string;
  display_url: string;
  domain: string;
  business_name: string | null;
  category: string | null;
  location: string | null;
  technologies_json: string;
  source_confidence: string;
  metadata_json: string;
  created_at: number;
  updated_at: number;
};

type LeadCandidateSourceRow = {
  id: string;
  candidate_id: string;
  source: SourceProvenance["source"];
  source_business_id: string | null;
  query: string | null;
  title: string | null;
  snippet: string | null;
  confidence: SourceProvenance["confidence"];
  metadata_json: string;
  created_at: number;
};

type LeadStageEventRow = {
  id: string;
  candidate_id: string;
  stage: LeadStageEvent["stage"];
  status: LeadStageEvent["status"];
  reason_code: string | null;
  message: string | null;
  metadata_json: string;
  created_at: number;
};

export interface LeadCandidateDetail extends SiteCandidate {
  priorityScore?: LeadPriorityScore;
  routeDecision?: LeadRouteDecision;
}

export async function upsertLeadCandidate(candidate: SiteCandidate, now = new Date()): Promise<SiteCandidate> {
  const durable = getDurableClient();
  const id = candidate.id ?? randomUUID();
  const createdAt = now.getTime();
  const params = candidateParams({ ...candidate, id }, createdAt);

  if (durable) {
    await durable.executeSql([
      {
        sql: leadCandidateUpsertSql(),
        params,
      },
      ...candidate.sourceProvenance.map((source) => ({
        sql: leadSourceInsertSql(),
        params: sourceParams(id, source, createdAt),
      })),
      ...candidate.contactHints.map((hint) => ({
        sql: leadContactInsertSql(),
        params: [
          randomUUID(),
          id,
          hint.type,
          hint.value,
          hint.sourceUrl ?? candidate.url,
          hint.confidence ?? "medium",
          hint.label ?? null,
          hint.reason ?? null,
          createdAt,
        ],
      })),
      ...candidate.stageEvents.map((event) => ({
        sql: leadStageInsertSql(),
        params: stageParams(id, event, createdAt),
      })),
    ]);
    return { ...candidate, id };
  }

  const db = await getDb();
  const tx = db.transaction(() => {
    db.prepare(leadCandidateUpsertSql()).run(...params);
    const insertSource = db.prepare(leadSourceInsertSql());
    for (const source of candidate.sourceProvenance) insertSource.run(...sourceParams(id, source, createdAt));
    const insertContact = db.prepare(leadContactInsertSql());
    for (const hint of candidate.contactHints) {
      insertContact.run(
        randomUUID(),
        id,
        hint.type,
        hint.value,
        hint.sourceUrl ?? candidate.url,
        hint.confidence ?? "medium",
        hint.label ?? null,
        hint.reason ?? null,
        createdAt,
      );
    }
    const insertStage = db.prepare(leadStageInsertSql());
    for (const event of candidate.stageEvents) insertStage.run(...stageParams(id, event, createdAt));
  });
  tx();
  return { ...candidate, id };
}

export async function appendLeadStageEvent(candidateId: string, event: LeadStageEvent, now = new Date()): Promise<void> {
  const durable = getDurableClient();
  const params = stageParams(candidateId, event, now.getTime());
  if (durable) {
    await durable.executeSql([{ sql: leadStageInsertSql(), params }]);
    return;
  }
  const db = await getDb();
  db.prepare(leadStageInsertSql()).run(...params);
}

export async function saveLeadPriorityScore(candidateId: string, score: LeadPriorityScore, now = new Date()): Promise<void> {
  const params = [
    randomUUID(),
    candidateId,
    score.total,
    score.label,
    json(score.components),
    JSON.stringify(score.reasons),
    now.getTime(),
  ];
  const sql = `INSERT INTO lead_priority_scores (
    id, candidate_id, total_score, label, components_json, reasons_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql, params }]);
    return;
  }
  const db = await getDb();
  db.prepare(sql).run(...params);
}

export async function saveLeadRouteDecision(candidateId: string, decision: LeadRouteDecision, now = new Date()): Promise<void> {
  const params = [
    randomUUID(),
    candidateId,
    decision.route,
    decision.status,
    decision.reasonCode,
    decision.message,
    decision.contactMethod ? JSON.stringify(decision.contactMethod) : null,
    decision.priorityScore ? JSON.stringify(decision.priorityScore) : null,
    now.getTime(),
  ];
  const sql = `INSERT INTO lead_route_decisions (
    id, candidate_id, route, status, reason_code, message, contact_method_json, priority_score_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql, params }]);
    return;
  }
  const db = await getDb();
  db.prepare(sql).run(...params);
}

export async function listLeadCandidates(limit = 100): Promise<LeadCandidateDetail[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 500));
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<LeadCandidateRow | LeadCandidateSourceRow | LeadStageEventRow>([
      { sql: "SELECT * FROM lead_candidates ORDER BY updated_at DESC LIMIT ?", params: [boundedLimit] },
    ]);
    return mapCandidateRows((results[0]?.results ?? []) as LeadCandidateRow[]);
  }
  const db = await getDb();
  const rows = db.prepare("SELECT * FROM lead_candidates ORDER BY updated_at DESC LIMIT ?").all(boundedLimit) as LeadCandidateRow[];
  return mapCandidateRows(rows);
}

export async function getLeadDiscoveryDb(): Promise<Database.Database> {
  return getDb();
}

export function providerMetadataSafe(value: Record<string, unknown>): JsonObject {
  return sanitizeProviderMetadata(value);
}

function candidateParams(candidate: SiteCandidate, now: number): unknown[] {
  return [
    candidate.id,
    candidate.normalizedUrl,
    candidate.url,
    candidate.domain,
    candidate.businessName ?? null,
    candidate.category ?? null,
    candidate.location ?? null,
    JSON.stringify(candidate.technologies),
    candidate.sourceConfidence,
    json(candidate.metadata),
    now,
    now,
  ];
}

function sourceParams(candidateId: string, source: SourceProvenance, now: number): unknown[] {
  return [
    randomUUID(),
    candidateId,
    source.source,
    source.sourceBusinessId ?? null,
    source.query ?? null,
    source.title ?? null,
    source.snippet ?? null,
    source.confidence,
    json(source.metadata),
    now,
  ];
}

function stageParams(candidateId: string, event: LeadStageEvent, now: number): unknown[] {
  return [
    randomUUID(),
    candidateId,
    event.stage,
    event.status,
    event.reasonCode ?? null,
    event.message ?? null,
    json(event.metadata ?? {}),
    event.createdAt ? new Date(event.createdAt).getTime() : now,
  ];
}

function leadCandidateUpsertSql(): string {
  return `INSERT INTO lead_candidates (
    id, normalized_url, display_url, domain, business_name, category, location,
    technologies_json, source_confidence, metadata_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(normalized_url) DO UPDATE SET
    display_url = excluded.display_url,
    domain = excluded.domain,
    business_name = COALESCE(excluded.business_name, lead_candidates.business_name),
    category = COALESCE(excluded.category, lead_candidates.category),
    location = COALESCE(excluded.location, lead_candidates.location),
    technologies_json = excluded.technologies_json,
    source_confidence = excluded.source_confidence,
    metadata_json = excluded.metadata_json,
    updated_at = excluded.updated_at`;
}

function leadSourceInsertSql(): string {
  return `INSERT INTO lead_candidate_sources (
    id, candidate_id, source, source_business_id, query, title, snippet, confidence, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

function leadStageInsertSql(): string {
  return `INSERT INTO lead_stage_events (
    id, candidate_id, stage, status, reason_code, message, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
}

function leadContactInsertSql(): string {
  return `INSERT INTO lead_contact_methods (
    id, candidate_id, type, value, source_url, confidence, label, reason, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

function json(value: JsonObject): string {
  return JSON.stringify(providerMetadataSafe(value));
}

function mapCandidateRows(rows: LeadCandidateRow[]): LeadCandidateDetail[] {
  return rows.map((row) => ({
    id: row.id,
    url: row.display_url,
    normalizedUrl: row.normalized_url,
    domain: row.domain,
    businessName: row.business_name ?? undefined,
    category: row.category ?? undefined,
    location: row.location ?? undefined,
    technologies: parseArray(row.technologies_json),
    contactHints: [],
    sourceProvenance: [],
    sourceConfidence: row.source_confidence as SiteCandidate["sourceConfidence"],
    stageEvents: [],
    metadata: parseObject(row.metadata_json),
  }));
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

function getDurableClient(): DurableHttpStorageClient | null {
  const config = getStorageConfig();
  if (config.mode !== "durable-http" || !config.durableHttp) return null;
  return new DurableHttpStorageClient({ config: config.durableHttp });
}

