import { Container, getContainer } from "@cloudflare/containers";
import { env as workerEnv } from "cloudflare:workers";
import { handleInternalStorage, handleStorageHealth } from "./storage-bridge";

type WorkerEnv = {
  REVENUE_AGENT_CONTAINER: DurableObjectNamespace<RevenueAgentContainer>;
  REVENUE_AGENT_RUN_LIMITER: RateLimit;
  OPERATIONAL_DB?: D1Database;
  OPERATIONAL_ARTIFACTS?: R2Bucket;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
};

const DEFAULT_CONTAINER_INSTANCE_NAME = "production-local";

const REQUIRED_ENV = [
  "REVENUE_AGENT_INTEGRATION_TOKEN",
  "FIRECRAWL_API_KEY",
  "GEMINI_API_KEY",
] as const;

const OPTIONAL_ENV = [
  "GEMINI_MODEL",
  "ZAI_API_KEY",
  "ZAI_BASE_URL",
  "ZAI_MODEL",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "SENDGRID_FROM_NAME",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "HIL_APPROVAL_TOKEN_SECRET",
  "HIL_APPROVAL_BASE_URL",
  "ADMIN_TOKEN",
  "DURABLE_STORAGE_BASE_URL",
  "DURABLE_STORAGE_TOKEN",
  "ARTIFACT_INLINE_BYTE_THRESHOLD",
] as const;

function readEnv(name: string): string | undefined {
  const value = (workerEnv as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildContainerEnvVars(): Record<string, string> {
  const envVars: Record<string, string> = {
    NODE_ENV: "production",
    PORT: "3000",
    CHROME_PATH: "/usr/bin/chromium",
    DB_PATH: "/tmp/revenue-agent/pipeline.db",
    OUTPUT_DIR: "/tmp/revenue-agent/proposals",
    REVENUE_AGENT_RATE_LIMIT_PER_MINUTE: readEnv("REVENUE_AGENT_RATE_LIMIT_PER_MINUTE") ?? "60",
    REVENUE_AGENT_ALLOW_EMAIL: readEnv("REVENUE_AGENT_ALLOW_EMAIL") ?? "false",
    REVENUE_AGENT_ALLOW_TELEGRAM: readEnv("REVENUE_AGENT_ALLOW_TELEGRAM") ?? "false",
    REVENUE_AGENT_ALLOW_PAYMENT_LINK: readEnv("REVENUE_AGENT_ALLOW_PAYMENT_LINK") ?? "false",
  };

  for (const name of [...REQUIRED_ENV, ...OPTIONAL_ENV]) {
    const value = readEnv(name);
    if (value) envVars[name] = value;
  }

  return envVars;
}

function isTelegramAuthorized(request: Request): boolean {
  const secret = readEnv("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) return true;
  return request.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

function resolveContainerInstanceName(env: WorkerEnv): string {
  const explicitName = readEnv("REVENUE_AGENT_CONTAINER_INSTANCE_NAME");
  if (explicitName) return sanitizeContainerInstanceName(explicitName);

  const versionId = env.CF_VERSION_METADATA?.id;
  if (!versionId) return DEFAULT_CONTAINER_INSTANCE_NAME;

  return sanitizeContainerInstanceName(`production-${versionId.slice(0, 12)}`);
}

function sanitizeContainerInstanceName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || DEFAULT_CONTAINER_INSTANCE_NAME;
}

export class RevenueAgentContainer extends Container {
  defaultPort = 3000;
  sleepAfter = readEnv("REVENUE_AGENT_CONTAINER_SLEEP_AFTER") ?? "10m";
  envVars = buildContainerEnvVars();

  override onStart() {
    console.log("RevenueAgentPlatform container started");
  }

  override onStop() {
    console.log("RevenueAgentPlatform container stopped");
  }

  override onError(error: unknown) {
    console.error("RevenueAgentPlatform container error", error);
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleStorageHealth(env);
    }

    if (url.pathname.startsWith("/internal/storage/")) {
      return handleInternalStorage(request, env, url, readEnv("DURABLE_STORAGE_TOKEN"));
    }

    const container = getContainer(env.REVENUE_AGENT_CONTAINER, resolveContainerInstanceName(env));

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (!isTelegramAuthorized(request)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      const body = await request.text();
      return container.fetch(
        new Request(`${url.origin}/telegram/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
      );
    }

    if (url.pathname === "/api/revenue-agent/run" && request.method === "POST") {
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.REVENUE_AGENT_RUN_LIMITER.limit({
        key: `run:${clientIp}`,
      });

      if (!success) {
        return Response.json({ error: "rate_limited" }, { status: 429 });
      }

      return container.fetch(request);
    }

    if (url.pathname === "/api/revenue-agent/run" || url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
      return container.fetch(request);
    }

    if (url.pathname === "/webhooks/stripe" || url.pathname.startsWith("/hil/") || url.pathname === "/thank-you") {
      return container.fetch(request);
    }

    if (url.pathname === "/sites" || url.pathname.startsWith("/sites/")) {
      const suffix = url.pathname === "/sites" ? "" : url.pathname.slice("/sites".length);
      url.pathname = `/admin/seo-sales/sites${suffix}`;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      return container.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
