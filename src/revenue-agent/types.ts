export type RevenueAgentStepStatus = "passed" | "failed" | "skipped";

export interface RevenueAgentStepResult {
  name: string;
  status: RevenueAgentStepStatus;
  durationMs: number;
  reason?: string;
  error?: string;
  details?: Record<string, unknown>;
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
  sendEmail?: boolean;
  sendTelegram?: boolean;
  createPaymentLink?: boolean;
  now?: () => Date;
}

export interface RevenueAgentRunRequest {
  url: string;
  sendEmail?: boolean;
  sendTelegram?: boolean;
  createPaymentLink?: boolean;
}
