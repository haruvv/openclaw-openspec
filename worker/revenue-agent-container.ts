import { Container, getContainer } from "@cloudflare/containers";
import { env as workerEnv } from "cloudflare:workers";

type WorkerEnv = {
  REVENUE_AGENT_CONTAINER: DurableObjectNamespace<RevenueAgentContainer>;
  REVENUE_AGENT_RUN_LIMITER: RateLimit;
};

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

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat?: {
    id: number | string;
    type?: string;
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

type RevenueAgentStep = {
  name?: string;
  status?: string;
  error?: string;
};

type RevenueAgentResult = {
  status?: string;
  targetUrl?: string;
  steps?: RevenueAgentStep[];
  outputs?: {
    domain?: string;
    seoScore?: number;
    proposalPath?: string;
    paymentLinkUrl?: string;
  };
  error?: string;
};

function isTelegramAuthorized(request: Request): boolean {
  const secret = readEnv("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) return true;
  return request.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

function isAllowedTelegramChat(chatId: number | string): boolean {
  const configured = readEnv("TELEGRAM_CHAT_ID");
  if (!configured) return true;
  const allowed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(String(chatId));
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'）)]+/i);
  return match?.[0] ?? null;
}

function chunkTelegramText(text: string): string[] {
  const chunks: string[] = [];
  const limit = 3900;
  for (let index = 0; index < text.length; index += limit) {
    chunks.push(text.slice(index, index + limit));
  }
  return chunks.length > 0 ? chunks : [text];
}

async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  const token = readEnv("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured; skipping Telegram reply");
    return;
  }

  for (const chunk of chunkTelegramText(text)) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Telegram sendMessage failed", response.status, body.slice(0, 500));
    }
  }
}

function formatRevenueAgentReply(result: RevenueAgentResult): string {
  const lines = [
    "RevenueAgent analysis complete.",
    "",
    `Status: ${result.status ?? "unknown"}`,
    result.targetUrl ? `Target: ${result.targetUrl}` : undefined,
    result.outputs?.domain ? `Domain: ${result.outputs.domain}` : undefined,
    typeof result.outputs?.seoScore === "number" ? `SEO score: ${result.outputs.seoScore}` : undefined,
    result.outputs?.proposalPath ? `Proposal: ${result.outputs.proposalPath}` : undefined,
    result.outputs?.paymentLinkUrl ? `Payment link: ${result.outputs.paymentLinkUrl}` : undefined,
  ].filter((line): line is string => Boolean(line));

  if (Array.isArray(result.steps) && result.steps.length > 0) {
    lines.push("", "Steps:");
    for (const step of result.steps) {
      const suffix = step.error ? ` (${step.error})` : "";
      lines.push(`- ${step.name ?? "unknown"}: ${step.status ?? "unknown"}${suffix}`);
    }
  }

  if (result.error) {
    lines.push("", `Error: ${result.error}`);
  }

  return lines.join("\n");
}

async function invokeRevenueAgent(container: DurableObjectStub, origin: string, targetUrl: string): Promise<RevenueAgentResult> {
  const token = readEnv("REVENUE_AGENT_INTEGRATION_TOKEN");
  if (!token) throw new Error("REVENUE_AGENT_INTEGRATION_TOKEN is not configured");

  const response = await container.fetch(
    new Request(`${origin}/api/revenue-agent/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        sendEmail: false,
        sendTelegram: false,
        createPaymentLink: false,
      }),
    }),
  );

  const text = await response.text();
  let payload: RevenueAgentResult;
  try {
    payload = JSON.parse(text) as RevenueAgentResult;
  } catch {
    payload = { status: response.ok ? "completed" : "failed", error: text.slice(0, 1000) };
  }

  if (!response.ok) {
    return {
      ...payload,
      status: payload.status ?? "failed",
      error: payload.error ?? `RevenueAgent API returned HTTP ${response.status}`,
    };
  }

  return payload;
}

async function handleTelegramUpdate(update: TelegramUpdate, container: DurableObjectStub, origin: string): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  if (!chatId || !text) return;
  if (!isAllowedTelegramChat(chatId)) {
    await sendTelegramMessage(chatId, "This Telegram chat is not authorized for RevenueAgentPlatform.");
    return;
  }

  const targetUrl = extractFirstUrl(text);
  if (!targetUrl) {
    await sendTelegramMessage(
      chatId,
      [
        "RevenueAgentPlatform is ready.",
        "",
        "Send a message that includes a target URL, for example:",
        "RevenueAgentで https://example.com を分析してください。",
      ].join("\n"),
    );
    return;
  }

  await sendTelegramMessage(chatId, `RevenueAgent analysis started: ${targetUrl}`);

  try {
    const result = await invokeRevenueAgent(container, origin, targetUrl);
    await sendTelegramMessage(chatId, formatRevenueAgentReply(result));
  } catch (error) {
    await sendTelegramMessage(
      chatId,
      `RevenueAgent analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const container = getContainer(env.REVENUE_AGENT_CONTAINER, "production");

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      if (!isTelegramAuthorized(request)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let update: TelegramUpdate;
      try {
        update = (await request.json()) as TelegramUpdate;
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }

      ctx.waitUntil(handleTelegramUpdate(update, container, url.origin));
      return Response.json({ ok: true });
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

    if (url.pathname === "/health" || url.pathname === "/api/revenue-agent/run") {
      return container.fetch(request);
    }

    if (url.pathname === "/webhooks/stripe" || url.pathname.startsWith("/hil/") || url.pathname === "/thank-you") {
      return container.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
