import type { Request, Response } from "express";
import { getSideEffectSettings } from "../admin/side-effect-settings.js";
import {
  cloudflareAccessConfigForMachine,
  logCloudflareAccessFailure,
  validateCloudflareAccessHeader,
} from "../security/cloudflare-access.js";
import { runRevenueAgent } from "./runner.js";
import {
  applySideEffectPolicy,
  checkRevenueAgentRateLimit,
  sanitizeRunReport,
  sideEffectPolicyReason,
  validateRevenueAgentAuth,
  validateSafeTargetUrl,
} from "./security.js";
import type { RevenueAgentRunRequest } from "./types.js";

export async function handleRevenueAgentRun(req: Request, res: Response): Promise<void> {
  const accessConfig = cloudflareAccessConfigForMachine();
  if (accessConfig.enabled) {
    const access = await validateCloudflareAccessHeader(req.headers["cf-access-jwt-assertion"], accessConfig, "service");
    if (!access.ok) {
      logCloudflareAccessFailure(req.originalUrl ?? req.url ?? "/api/revenue-agent/run", access.status);
      res.status(access.status).json(access.body);
      return;
    }
  }

  const auth = validateRevenueAgentAuth(req.headers.authorization);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }

  const rateLimit = checkRevenueAgentRateLimit(req);
  if (!rateLimit.allowed) {
    if (rateLimit.retryAfterSeconds) res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const parsed = parseRunRequest(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const safeUrl = await validateSafeTargetUrl(parsed.value.url);
  if (!safeUrl.ok) {
    res.status(400).json({ error: safeUrl.error });
    return;
  }

  const requested = {
    sendEmail: parsed.value.sendEmail === true,
    sendTelegram: parsed.value.sendTelegram === true,
    createPaymentLink: parsed.value.createPaymentLink === true,
  };
  const allowed = applySideEffectPolicy(requested, await getSideEffectSettings());
  const sideEffectSkipReasons = {
    sendEmail: requested.sendEmail && !allowed.sendEmail ? sideEffectPolicyReason("sendEmail") : undefined,
    sendTelegram:
      requested.sendTelegram && !allowed.sendTelegram ? sideEffectPolicyReason("sendTelegram") : undefined,
    createPaymentLink:
      requested.createPaymentLink && !allowed.createPaymentLink
        ? sideEffectPolicyReason("createPaymentLink")
        : undefined,
  };

  const report = await runRevenueAgent({
    targetUrl: safeUrl.url,
    source: "api",
    sendEmail: allowed.sendEmail,
    sendTelegram: allowed.sendTelegram,
    createPaymentLink: allowed.createPaymentLink,
    sideEffectSkipReasons,
  });
  res.status(report.status === "failed" ? 502 : 200).json(sanitizeRunReport(report));
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
