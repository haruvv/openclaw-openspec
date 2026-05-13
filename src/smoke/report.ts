import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SmokeRunReport } from "./types.js";
import { summarizeRunStatus } from "../revenue-agent/runner.js";

export function summarizeSmokeStatus(steps: SmokeRunReport["steps"]): SmokeRunReport["status"] {
  return summarizeRunStatus(steps);
}

export async function saveSmokeReport(
  report: SmokeRunReport,
  reportDir = process.env.SMOKE_REPORT_DIR ?? "./output/smoke-runs"
): Promise<string> {
  await mkdir(reportDir, { recursive: true });
  const path = join(reportDir, `${report.id}.json`);
  await writeFile(path, JSON.stringify({ ...report, reportPath: path }, null, 2), "utf-8");
  return path;
}
