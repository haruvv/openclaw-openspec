import "dotenv/config";
import { runRevenueAgent } from "../revenue-agent/runner.js";
import { saveSmokeReport } from "./report.js";
import type { SmokeOptions, SmokeRunReport } from "./types.js";

const DEFAULT_TARGET_URL = "https://example.com";

export async function runE2eSmoke(options: SmokeOptions = {}): Promise<SmokeRunReport> {
  const report = await runRevenueAgent({
    targetUrl: options.targetUrl ?? process.env.SMOKE_TARGET_URL ?? DEFAULT_TARGET_URL,
    sendEmail: process.env.SMOKE_SEND_EMAIL === "true",
    sendTelegram: process.env.SMOKE_SEND_TELEGRAM === "true",
    createPaymentLink: process.env.SMOKE_CREATE_STRIPE_LINK === "true",
    now: options.now,
  });
  report.reportPath = await saveSmokeReport(report, options.reportDir);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targetUrl = process.argv[2];
  const report = await runE2eSmoke({ targetUrl });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "failed") process.exitCode = 1;
}
