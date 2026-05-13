import type { Request, Response } from "express";
import { runRevenueAgent } from "./runner.js";
import type { RevenueAgentRunRequest } from "./types.js";

export async function handleRevenueAgentRun(req: Request, res: Response): Promise<void> {
  const token = process.env.REVENUE_AGENT_INTEGRATION_TOKEN;
  if (!token) {
    res.status(503).json({ error: "REVENUE_AGENT_INTEGRATION_TOKEN is not configured" });
    return;
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = parseRunRequest(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const report = await runRevenueAgent({
    targetUrl: parsed.value.url,
    sendEmail: parsed.value.sendEmail === true,
    sendTelegram: parsed.value.sendTelegram === true,
    createPaymentLink: parsed.value.createPaymentLink === true,
  });
  res.status(report.status === "failed" ? 502 : 200).json(report);
}

function parseRunRequest(body: unknown):
  | { ok: true; value: RevenueAgentRunRequest }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be an object" };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.url !== "string") {
    return { ok: false, error: "url is required" };
  }
  try {
    const url = new URL(candidate.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "url must be http or https" };
    }
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }
  for (const key of ["sendEmail", "sendTelegram", "createPaymentLink"]) {
    if (candidate[key] !== undefined && typeof candidate[key] !== "boolean") {
      return { ok: false, error: `${key} must be a boolean` };
    }
  }
  return {
    ok: true,
    value: {
      url: candidate.url,
      sendEmail: candidate.sendEmail,
      sendTelegram: candidate.sendTelegram,
      createPaymentLink: candidate.createPaymentLink,
    } as RevenueAgentRunRequest,
  };
}
