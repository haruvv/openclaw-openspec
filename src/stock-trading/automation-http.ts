import type { Request, Response } from "express";
import { validateRevenueAgentAuth } from "../revenue-agent/security.js";
import { runStockAutonomousPaperCycle } from "./automation.js";

export async function handleStockTradingCycleJob(req: Request, res: Response): Promise<void> {
  const auth = validateRevenueAgentAuth(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }

  const result = await runStockAutonomousPaperCycle();
  res.status(200).json(result);
}
