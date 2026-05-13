import type { RevenueAgentRunReport, RevenueAgentRunOptions, RevenueAgentStepResult, RevenueAgentStepStatus } from "../revenue-agent/types.js";

export type SmokeStepStatus = RevenueAgentStepStatus;

export type SmokeStepResult = RevenueAgentStepResult;

export type SmokeRunReport = RevenueAgentRunReport;

export interface SmokeOptions {
  targetUrl?: string;
  now?: RevenueAgentRunOptions["now"];
  reportDir?: string;
}
