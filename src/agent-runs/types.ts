export type AgentRunStatus = "running" | "passed" | "failed" | "skipped";

export type AgentRunSource = "api" | "telegram" | "manual" | string;

export interface AgentRunRecord {
  id: string;
  agentType: string;
  source: AgentRunSource;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  summary: Record<string, unknown>;
  error?: string;
  metadata: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRunStepRecord {
  id: string;
  runId: string;
  name: string;
  status: Exclude<AgentRunStatus, "running">;
  durationMs: number;
  reason?: string;
  error?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentArtifactRecord {
  id: string;
  runId: string;
  type: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRunDetail extends AgentRunRecord {
  steps: AgentRunStepRecord[];
  artifacts: AgentArtifactRecord[];
}
