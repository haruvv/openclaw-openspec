export type SmokeStepStatus = "passed" | "failed" | "skipped";

export interface SmokeStepResult {
  name: string;
  status: SmokeStepStatus;
  durationMs: number;
  reason?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface SmokeRunReport {
  id: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  status: SmokeStepStatus;
  steps: SmokeStepResult[];
  outputs: Record<string, unknown>;
  reportPath?: string;
}

export interface SmokeOptions {
  targetUrl?: string;
  now?: () => Date;
  reportDir?: string;
}
