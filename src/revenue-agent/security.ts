import { timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import type { Request } from "express";
import type { RevenueAgentRunReport } from "./types.js";

export interface AuthFailure {
  ok: false;
  status: 401 | 503;
  body: { error: string };
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface SideEffectPolicy {
  sendEmail: boolean;
  sendTelegram: boolean;
  createPaymentLink: boolean;
}

type DnsLookup = typeof lookup;

const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();

export function validateRevenueAgentAuth(header: unknown, expectedToken = process.env.REVENUE_AGENT_INTEGRATION_TOKEN):
  | { ok: true }
  | AuthFailure {
  if (!expectedToken) {
    return { ok: false, status: 503, body: { error: "Service unavailable" } };
  }
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const candidate = header.slice("Bearer ".length);
  if (!constantTimeEqual(candidate, expectedToken)) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return { ok: true };
}

export async function validateSafeTargetUrl(
  input: string,
  options: { dnsLookup?: DnsLookup } = {}
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "url must be http or https" };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) return { ok: false, error: "url host is required" };
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, error: "url host is not allowed" };
  }

  if (isUnsafeIpAddress(hostname)) {
    return { ok: false, error: "url host is not allowed" };
  }

  if (net.isIP(hostname) === 0) {
    const dnsLookup = options.dnsLookup ?? lookup;
    try {
      const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
      if (addresses.some((entry) => isUnsafeIpAddress(entry.address))) {
        return { ok: false, error: "url host resolves to a disallowed address" };
      }
    } catch {
      return { ok: false, error: "url host could not be resolved" };
    }
  }

  return { ok: true, url: input };
}

export function checkRevenueAgentRateLimit(req: Request, now = Date.now()): RateLimitResult {
  const limit = Number(process.env.REVENUE_AGENT_RATE_LIMIT_PER_MINUTE ?? 60);
  if (!Number.isFinite(limit) || limit <= 0) return { allowed: true };

  const windowMs = 60_000;
  const key = getRateLimitKey(req);
  const current = rateLimitWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { allowed: true };
}

export function resetRevenueAgentRateLimit(): void {
  rateLimitWindows.clear();
}

export function getSideEffectPolicy(env = process.env): SideEffectPolicy {
  return {
    sendEmail: env.REVENUE_AGENT_ALLOW_EMAIL === "true",
    sendTelegram: env.REVENUE_AGENT_ALLOW_TELEGRAM === "true",
    createPaymentLink: env.REVENUE_AGENT_ALLOW_PAYMENT_LINK === "true",
  };
}

export function applySideEffectPolicy(
  requested: SideEffectPolicy,
  policy = getSideEffectPolicy()
): SideEffectPolicy {
  return {
    sendEmail: requested.sendEmail && policy.sendEmail,
    sendTelegram: requested.sendTelegram && policy.sendTelegram,
    createPaymentLink: requested.createPaymentLink && policy.createPaymentLink,
  };
}

export function sideEffectPolicyReason(action: keyof SideEffectPolicy): string {
  const names: Record<keyof SideEffectPolicy, string> = {
    sendEmail: "email side effects are disabled by server policy",
    sendTelegram: "Telegram side effects are disabled by server policy",
    createPaymentLink: "payment-link side effects are disabled by server policy",
  };
  return names[action];
}

export function sanitizeSecretText(input: unknown, env = process.env): string {
  let output = input instanceof Error ? input.message : String(input);
  for (const secret of collectSecrets(env)) {
    output = output.split(secret).join("[REDACTED]");
  }
  output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  output = output.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]");
  return output;
}

export function sanitizeRunReport(report: RevenueAgentRunReport): RevenueAgentRunReport {
  return {
    ...report,
    steps: report.steps.map((step) => ({
      ...step,
      error: step.error ? sanitizeSecretText(step.error) : undefined,
    })),
  };
}

function constantTimeEqual(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function getRateLimitKey(req: Request): string {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string") return `auth:${authorization}`;
  const forwarded = req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return `ip:${forwarded.split(",")[0]?.trim() ?? "unknown"}`;
  return `ip:${req.ip ?? "unknown"}`;
}

function collectSecrets(env: NodeJS.ProcessEnv): string[] {
  return [
    env.REVENUE_AGENT_INTEGRATION_TOKEN,
    env.FIRECRAWL_API_KEY,
    env.GEMINI_API_KEY,
    env.ZAI_API_KEY,
    env.SENDGRID_API_KEY,
    env.STRIPE_SECRET_KEY,
    env.STRIPE_WEBHOOK_SECRET,
    env.TELEGRAM_BOT_TOKEN,
    env.HIL_APPROVAL_TOKEN_SECRET,
  ].filter((value): value is string => Boolean(value && value.length >= 6));
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function isUnsafeIpAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isUnsafeIpv4(address);
  if (family === 6) return isUnsafeIpv6(address);
  return false;
}

function isUnsafeIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff") ||
    normalized.includes("::ffff:127.") ||
    normalized.includes("::ffff:10.") ||
    normalized.includes("::ffff:192.168.") ||
    normalized.includes("::ffff:169.254.")
  );
}
