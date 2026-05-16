export interface FailureDiagnostic {
  stage: string;
  reason: string;
  message: string;
  name?: string;
  durationMs?: number;
  retryable?: boolean;
  exitCode?: string | number;
  signal?: string;
  stderrExcerpt?: string;
  stdoutExcerpt?: string;
}

const MAX_EXCERPT_LENGTH = 1200;

export function buildFailureDiagnostic(
  error: unknown,
  input: {
    stage: string;
    reason?: string;
    durationMs?: number;
    retryable?: boolean;
  }
): FailureDiagnostic {
  const record = isRecord(error) ? error : {};
  const message = sanitizeDiagnosticText(error);
  const reason = input.reason ?? classifyFailureReason(error, message);
  return pruneUndefined({
    stage: input.stage,
    reason,
    message,
    name: error instanceof Error ? error.name : typeof record.name === "string" ? record.name : undefined,
    durationMs: input.durationMs,
    retryable: input.retryable ?? isRetryableFailure(reason),
    exitCode: typeof record.code === "string" || typeof record.code === "number" ? record.code : undefined,
    signal: typeof record.signal === "string" ? record.signal : undefined,
    stderrExcerpt: typeof record.stderr === "string" ? sanitizeDiagnosticText(record.stderr, MAX_EXCERPT_LENGTH) : undefined,
    stdoutExcerpt: typeof record.stdout === "string" ? sanitizeDiagnosticText(record.stdout, MAX_EXCERPT_LENGTH) : undefined,
  });
}

export function buildSkipDiagnostic(stage: string, reason: string): FailureDiagnostic {
  return {
    stage,
    reason: classifySkipReason(reason),
    message: sanitizeDiagnosticText(reason),
    retryable: isRetryableSkip(reason),
  };
}

export function sanitizeDiagnosticText(input: unknown, maxLength = MAX_EXCERPT_LENGTH, env = process.env): string {
  let output = input instanceof Error ? input.message : String(input);
  for (const secret of collectSecrets(env)) {
    output = output.split(secret).join("[REDACTED]");
  }
  output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  output = output.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]");
  output = output.replace(/(client_secret=)[^&\s]+/gi, "$1[REDACTED]");
  output = output.replace(/(api[_-]?key=)[^&\s]+/gi, "$1[REDACTED]");
  output = output.trim();
  return output.length > maxLength ? `${output.slice(0, maxLength)}...` : output;
}

function classifyFailureReason(error: unknown, message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || isAbortError(error)) return "timeout";
  if (lower.includes("json") || lower.includes("parse")) return "parse_error";
  if (isRecord(error) && (typeof error.code === "string" || typeof error.code === "number")) return "process_error";
  return "provider_error";
}

function classifySkipReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("not set") || lower.includes("missing")) return "missing_configuration";
  if (lower.includes("disabled")) return "disabled_by_policy";
  if (lower.includes("approval")) return "pending_approval";
  return "skipped";
}

function isRetryableFailure(reason: string): boolean {
  return ["timeout", "process_error", "provider_error"].includes(reason);
}

function isRetryableSkip(reason: string): boolean {
  return reason.toLowerCase().includes("not set") || reason.toLowerCase().includes("missing");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
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
    env.CLOUDFLARE_ACCESS_ADMIN_AUD,
    env.CLOUDFLARE_ACCESS_MACHINE_AUD,
  ].filter((value): value is string => Boolean(value && value.length >= 6));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
