import type { Request, Response } from "express";
import { validateRevenueAgentAuth } from "../revenue-agent/security.js";
import { runDailyDiscoveryJob } from "./job.js";

export async function handleDailyDiscoveryJob(req: Request, res: Response): Promise<void> {
  const auth = validateRevenueAgentAuth(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }

  const report = await runDailyDiscoveryJob();
  res.status(report.status === "failed" ? 502 : 200).json(report);
}
