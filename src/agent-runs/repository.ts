import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "../utils/db.js";
import type { AgentArtifactRecord, AgentRunDetail, AgentRunRecord, AgentRunStatus, AgentRunStepRecord } from "./types.js";

type JsonObject = Record<string, unknown>;

export interface CreateAgentRunInput {
  id: string;
  agentType: string;
  source: string;
  input: JsonObject;
  metadata?: JsonObject;
  startedAt: Date;
}

export interface CompleteAgentRunInput {
  id: string;
  status: Exclude<AgentRunStatus, "running">;
  summary?: JsonObject;
  error?: string;
  completedAt: Date;
  steps: Array<{
    name: string;
    status: Exclude<AgentRunStatus, "running">;
    durationMs: number;
    reason?: string;
    error?: string;
    details?: JsonObject;
  }>;
  artifacts?: Array<{
    type: string;
    label: string;
    pathOrUrl?: string;
    contentText?: string;
    metadata?: JsonObject;
  }>;
}

type AgentRunRow = {
  id: string;
  agent_type: string;
  source: string;
  status: AgentRunStatus;
  input_json: string;
  summary_json: string;
  error: string | null;
  metadata_json: string;
  started_at: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
};

type AgentRunStepRow = {
  id: string;
  run_id: string;
  name: string;
  status: Exclude<AgentRunStatus, "running">;
  duration_ms: number;
  reason: string | null;
  error: string | null;
  details_json: string;
  created_at: number;
};

type AgentArtifactRow = {
  id: string;
  run_id: string;
  type: string;
  label: string;
  path_or_url: string | null;
  content_text: string | null;
  metadata_json: string;
  created_at: number;
};

export async function createAgentRun(input: CreateAgentRunInput): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO agent_runs (
      id, agent_type, source, status, input_json, summary_json, error, metadata_json,
      started_at, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'running', ?, ?, NULL, ?, ?, NULL, ?, ?)`
  ).run(
    input.id,
    input.agentType,
    input.source,
    json(input.input),
    json({}),
    json(input.metadata ?? {}),
    input.startedAt.getTime(),
    now,
    now,
  );
}

export async function completeAgentRun(input: CompleteAgentRunInput): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE agent_runs
       SET status = ?, summary_json = ?, error = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.status, json(input.summary ?? {}), input.error ?? null, input.completedAt.getTime(), now, input.id);

    db.prepare("DELETE FROM agent_run_steps WHERE run_id = ?").run(input.id);
    db.prepare("DELETE FROM agent_artifacts WHERE run_id = ?").run(input.id);

    const insertStep = db.prepare(
      `INSERT INTO agent_run_steps (
        id, run_id, name, status, duration_ms, reason, error, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const step of input.steps) {
      insertStep.run(
        randomUUID(),
        input.id,
        step.name,
        step.status,
        step.durationMs,
        step.reason ?? null,
        step.error ?? null,
        json(step.details ?? {}),
        now,
      );
    }

    const insertArtifact = db.prepare(
      `INSERT INTO agent_artifacts (
        id, run_id, type, label, path_or_url, content_text, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const artifact of input.artifacts ?? []) {
      insertArtifact.run(
        randomUUID(),
        input.id,
        artifact.type,
        artifact.label,
        artifact.pathOrUrl ?? null,
        artifact.contentText ?? null,
        json(artifact.metadata ?? {}),
        now,
      );
    }
  });

  tx();
}

export async function listAgentRuns(limit = 50): Promise<AgentRunRecord[]> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?")
    .all(Math.max(1, Math.min(limit, 200))) as AgentRunRow[];
  return rows.map(mapRunRow);
}

export async function getAgentRunDetail(id: string): Promise<AgentRunDetail | null> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as AgentRunRow | undefined;
  if (!row) return null;
  const steps = db
    .prepare("SELECT * FROM agent_run_steps WHERE run_id = ? ORDER BY created_at ASC")
    .all(id) as AgentRunStepRow[];
  const artifacts = db
    .prepare("SELECT * FROM agent_artifacts WHERE run_id = ? ORDER BY created_at ASC")
    .all(id) as AgentArtifactRow[];
  return {
    ...mapRunRow(row),
    steps: steps.map(mapStepRow),
    artifacts: artifacts.map(mapArtifactRow),
  };
}

export async function getAgentRunDb(): Promise<Database.Database> {
  return getDb();
}

function mapRunRow(row: AgentRunRow): AgentRunRecord {
  return {
    id: row.id,
    agentType: row.agent_type,
    source: row.source,
    status: row.status,
    input: parseJson(row.input_json),
    summary: parseJson(row.summary_json),
    error: row.error ?? undefined,
    metadata: parseJson(row.metadata_json),
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapStepRow(row: AgentRunStepRow): AgentRunStepRecord {
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    status: row.status,
    durationMs: row.duration_ms,
    reason: row.reason ?? undefined,
    error: row.error ?? undefined,
    details: parseJson(row.details_json),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapArtifactRow(row: AgentArtifactRow): AgentArtifactRecord {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
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

function parseJson(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}
