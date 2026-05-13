import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SmokeRunReport } from "./types.js";

export function summarizeSmokeStatus(steps: SmokeRunReport["steps"]): SmokeRunReport["status"] {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.every((step) => step.status === "skipped")) return "skipped";
  return "passed";
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
