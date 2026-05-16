import type { FailureDiagnostic } from "../utils/failure-diagnostics.js";

export type RevenueAgentStepStatus = "passed" | "failed" | "skipped";

export interface RevenueAgentStepResult {
  name: string;
  status: RevenueAgentStepStatus;
  durationMs: number;
  reason?: string;
  error?: string;
  details?: Record<string, unknown> & {
    diagnostic?: FailureDiagnostic;
    failure?: FailureDiagnostic;
    warnings?: FailureDiagnostic[];
  };
}

export interface RevenueAgentRunReport {
  id: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  status: RevenueAgentStepStatus;
  steps: RevenueAgentStepResult[];
  outputs: Record<string, unknown>;
  reportPath?: string;
}

export interface RevenueAgentRunOptions {
  targetUrl: string;
  source?: "api" | "telegram" | "manual" | string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
  sendTelegram?: boolean;
  createPaymentLink?: boolean;
  sideEffectSkipReasons?: Partial<Record<"sendEmail" | "sendTelegram" | "createPaymentLink", string>>;
  now?: () => Date;
}

export interface RevenueAgentRunRequest {
  url: string;
  sendEmail?: boolean;
  sendTelegram?: boolean;
  createPaymentLink?: boolean;
}
